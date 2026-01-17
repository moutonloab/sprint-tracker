# Browser Version Implementation Plan

## Executive Summary

The sprint-tracker CLI application has a clean separation of concerns that enables code sharing between CLI and browser versions. The core business logic (types, validation, services) is already portable.

**What can be reused:**
- `src/types.ts` - Data models (no dependencies)
- `src/validation.ts` - Input validation (pure functions)
- `src/services/` - Business logic (needs async refactoring)

**What needs replacement:**
- `src/db/database.ts` - better-sqlite3 → IndexedDB
- `src/cli/` - Commander.js → React UI

---

## 1. Project Restructuring: Monorepo

### Current Structure
```
sprint-tracker/
├── src/
│   ├── types.ts          # PORTABLE
│   ├── validation.ts     # PORTABLE
│   ├── db/database.ts    # NODE-ONLY
│   ├── services/         # NEEDS ASYNC REFACTOR
│   └── cli/              # NODE-ONLY
```

### Proposed Monorepo Structure
```
sprint-tracker/
├── packages/
│   ├── core/                    # Shared business logic
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── validation.ts
│   │   │   ├── interfaces/
│   │   │   │   └── storage.ts   # Database abstraction
│   │   │   └── services/
│   │   │       ├── sprint-service.ts
│   │   │       ├── goal-service.ts
│   │   │       ├── criterion-service.ts
│   │   │       └── export-service.ts
│   │   └── package.json
│   │
│   ├── cli/                     # CLI application
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   └── sqlite-storage.ts
│   │   │   ├── commands/
│   │   │   ├── formatter.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── web/                     # Browser application
│       ├── src/
│       │   ├── db/
│       │   │   └── indexeddb-storage.ts
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── pages/
│       │   └── App.tsx
│       ├── package.json
│       └── vite.config.ts
│
├── package.json                 # Root workspace
└── pnpm-workspace.yaml
```

---

## 2. Storage Abstraction Layer

### 2.1 Storage Interface

```typescript
// packages/core/src/interfaces/storage.ts

export interface StorageAdapter {
  // Sprint operations
  createSprint(sprint: Sprint): Promise<void>;
  getSprintById(id: string): Promise<Sprint | null>;
  getSprintByVolgnummer(volgnummer: number): Promise<Sprint | null>;
  getAllSprints(): Promise<Sprint[]>;
  updateSprint(id: string, updates: Partial<Sprint>): Promise<void>;
  deleteSprint(id: string): Promise<boolean>;
  getMaxVolgnummer(): Promise<number | null>;
  getCurrentSprint(today: string): Promise<Sprint | null>;

  // Goal operations
  createGoal(goal: Goal): Promise<void>;
  getGoalById(id: string): Promise<Goal | null>;
  getGoalsBySprintId(sprintId: string): Promise<Goal[]>;
  getGoalsByOwner(owner: string): Promise<Goal[]>;
  getAllGoals(): Promise<Goal[]>;
  updateGoal(id: string, updates: Partial<Goal>): Promise<void>;
  deleteGoal(id: string): Promise<boolean>;
  sprintExists(sprintId: string): Promise<boolean>;

  // Criterion operations
  createCriterion(criterion: SuccessCriterion): Promise<void>;
  getCriterionById(id: string): Promise<SuccessCriterion | null>;
  getCriteriaByGoalId(goalId: string): Promise<SuccessCriterion[]>;
  updateCriterion(id: string, updates: Partial<SuccessCriterion>): Promise<void>;
  deleteCriterion(id: string): Promise<boolean>;
  goalExists(goalId: string): Promise<boolean>;

  // Transaction support
  transaction<T>(fn: () => Promise<T>): Promise<T>;

  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}
```

### 2.2 Service Refactoring Pattern

**Current (synchronous):**
```typescript
export class SprintService {
  private db: Database.Database;
  create(input: CreateSprintInput): Sprint { ... }
}
```

**New (async with interface):**
```typescript
export class SprintService {
  constructor(private storage: StorageAdapter) {}
  async create(input: CreateSprintInput): Promise<Sprint> {
    const validation = validateCreateSprint(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    const id = uuidv4();
    const sprint: Sprint = { id, ...input };
    await this.storage.createSprint(sprint);
    return sprint;
  }
}
```

### 2.3 Browser Storage Options: Deep Comparison

#### Current SQL Query Patterns (from codebase analysis)

| Query Type | Example | Frequency |
|------------|---------|-----------|
| CRUD by ID | `SELECT * FROM sprint WHERE id = ?` | High |
| Index lookup | `WHERE volgnummer = ?`, `WHERE sprint_id = ?` | High |
| Range query | `WHERE startdatum <= ? AND einddatum >= ?` | Low |
| Ordering | `ORDER BY volgnummer DESC LIMIT 1` | Medium |
| Aggregation | `SELECT MAX(volgnummer)` | Low |
| Existence check | `SELECT id FROM sprint WHERE id = ?` | Medium |

**Notable:** No complex JOINs, subqueries, or window functions. All queries use simple indexes.

---

#### Option A: IndexedDB (Native)

**How it works:** Browser-native key-value store with indexes and cursors.

| Aspect | Details |
|--------|---------|
| **Bundle size** | 0 KB (native API) |
| **Storage limit** | ~50% of disk (hundreds of MB to GB) |
| **Persistence** | Automatic, durable |
| **API style** | Async, event-based (or Promise-wrapped) |
| **Query model** | Index lookups + cursor iteration |

**Pros:**
- Zero bundle overhead
- Native browser optimization
- Built-in persistence
- Large storage capacity
- Well-suited for this app's simple query patterns

**Cons:**
- Verbose API (mitigated by Dexie.js wrapper)
- Need to rewrite SQL queries as IndexedDB operations
- Different transaction model (auto-commit per operation)
- Range queries require cursor iteration

**Query Translation Examples:**
```typescript
// SQL: SELECT * FROM sprint WHERE volgnummer = ?
// IndexedDB:
const sprint = await store.index('volgnummer').get(volgnummer);

// SQL: SELECT * FROM sprint WHERE startdatum <= ? AND einddatum >= ?
// IndexedDB:
const range = IDBKeyRange.upperBound(today);
const cursor = store.index('startdatum').openCursor(range);
// Filter in code: row.einddatum >= today

// SQL: SELECT MAX(volgnummer) FROM sprint
// IndexedDB:
const cursor = store.index('volgnummer').openCursor(null, 'prev');
const max = cursor ? cursor.value.volgnummer : null;
```

---

#### Option B: sql.js + localStorage

**How it works:** SQLite compiled to WebAssembly, DB persisted to localStorage as binary.

| Aspect | Details |
|--------|---------|
| **Bundle size** | ~500 KB gzipped (~1.5 MB uncompressed) |
| **Storage limit** | 5-10 MB (localStorage limit) |
| **Persistence** | Manual save/load required |
| **API style** | Sync in-memory, async load/save |
| **Query model** | Full SQL |

**Pros:**
- Identical SQL queries to CLI version
- Familiar ACID transaction model
- Single-file export (entire DB binary)
- Complex queries easy (though not needed here)

**Cons:**
- 500 KB bundle size impact
- 5-10 MB localStorage limit can be exceeded with large text fields
- Manual persistence (must call save after writes)
- Entire DB in memory
- Risk of data loss on incomplete saves

**Persistence Pattern:**
```typescript
// Load on startup
const SQL = await initSqlJs({ locateFile: f => `/sql.js/${f}` });
const saved = localStorage.getItem('sprint-tracker-db');
const db = saved ? new SQL.Database(base64ToUint8Array(saved)) : new SQL.Database();

// Save after each write
function saveDb() {
  const data = db.export();
  localStorage.setItem('sprint-tracker-db', uint8ArrayToBase64(data));
}
```

---

#### Option C: sql.js + IndexedDB (Hybrid)

**How it works:** SQLite in WASM, but persist the DB file to IndexedDB instead of localStorage.

| Aspect | Details |
|--------|---------|
| **Bundle size** | ~500 KB gzipped |
| **Storage limit** | ~50% of disk (IndexedDB) |
| **Persistence** | Manual save to IndexedDB |
| **API style** | Sync queries, async persistence |
| **Query model** | Full SQL |

**Pros:**
- SQL queries preserved
- No localStorage size limit
- Familiar model for SQLite users

**Cons:**
- Still 500 KB bundle overhead
- Still requires manual persistence
- Entire DB loaded into memory on startup
- More complex initialization

---

#### Recommendation Matrix

| Factor | IndexedDB | sql.js + localStorage | sql.js + IndexedDB |
|--------|-----------|----------------------|-------------------|
| Bundle size | ✅ 0 KB | ❌ 500 KB | ❌ 500 KB |
| Storage capacity | ✅ Large | ❌ 5-10 MB | ✅ Large |
| Query reuse | ❌ Rewrite | ✅ Same SQL | ✅ Same SQL |
| Auto-persistence | ✅ Yes | ❌ Manual | ❌ Manual |
| Startup time | ✅ Fast | ⚠️ Medium | ⚠️ Medium |
| Memory usage | ✅ On-demand | ❌ Full DB | ❌ Full DB |
| Data safety | ✅ Native | ⚠️ Save risk | ⚠️ Save risk |

---

#### Decision: IndexedDB (with Dexie.js)

**Primary choice: IndexedDB** wrapped with [Dexie.js](https://dexie.org/) for ergonomic API.

**Rationale:**
1. **Query complexity is low** - All current queries translate efficiently to IndexedDB indexes
2. **Bundle size matters** - 500 KB is significant for a lightweight app
3. **Data safety** - Native persistence eliminates manual save bugs
4. **Future-proof** - Native APIs improve over time

**When to reconsider sql.js:**
- If complex reporting queries are added (aggregations, JOINs across entities)
- If data export must be SQLite-compatible binary format
- If team strongly prefers SQL over IndexedDB patterns

---

#### Implementation with Dexie.js

```typescript
// packages/web/src/db/dexie-storage.ts
import Dexie, { Table } from 'dexie';
import { Sprint, Goal, SuccessCriterion } from '@sprint-tracker/core';

class SprintTrackerDB extends Dexie {
  sprints!: Table<Sprint, string>;
  goals!: Table<Goal, string>;
  criteria!: Table<SuccessCriterion, string>;

  constructor() {
    super('sprint-tracker');
    this.version(1).stores({
      sprints: 'id, volgnummer, startdatum, einddatum',
      goals: 'id, sprint_id, eigenaar, aangemaakt_op',
      criteria: 'id, goal_id'
    });
  }
}

export class DexieStorage implements StorageAdapter {
  private db = new SprintTrackerDB();

  async initialize(): Promise<void> {
    await this.db.open();
  }

  async getSprintById(id: string): Promise<Sprint | null> {
    return await this.db.sprints.get(id) ?? null;
  }

  async getSprintByVolgnummer(volgnummer: number): Promise<Sprint | null> {
    return await this.db.sprints.where('volgnummer').equals(volgnummer).first() ?? null;
  }

  async getCurrentSprint(today: string): Promise<Sprint | null> {
    // Range query: startdatum <= today AND einddatum >= today
    return await this.db.sprints
      .where('startdatum').belowOrEqual(today)
      .filter(s => s.einddatum >= today)
      .reverse()
      .first() ?? null;
  }

  async getMaxVolgnummer(): Promise<number | null> {
    const last = await this.db.sprints.orderBy('volgnummer').reverse().first();
    return last?.volgnummer ?? null;
  }

  async getAllSprints(): Promise<Sprint[]> {
    return await this.db.sprints.orderBy('volgnummer').toArray();
  }

  async createSprint(sprint: Sprint): Promise<void> {
    await this.db.sprints.add(sprint);
  }

  async deleteSprint(id: string): Promise<boolean> {
    // Cascade delete goals and criteria
    await this.db.transaction('rw', [this.db.sprints, this.db.goals, this.db.criteria], async () => {
      const goalIds = await this.db.goals.where('sprint_id').equals(id).primaryKeys();
      await this.db.criteria.where('goal_id').anyOf(goalIds).delete();
      await this.db.goals.where('sprint_id').equals(id).delete();
      await this.db.sprints.delete(id);
    });
    return true;
  }

  // ... other methods follow same pattern
}
```

**Dexie.js benefits:**
- 25 KB gzipped (vs 500 KB for sql.js)
- Promise-based API
- Type-safe with TypeScript
- Handles IndexedDB quirks across browsers
- Built-in transaction support

---

## 3. UI Framework & Components

### 3.1 Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 18 | Ecosystem, TypeScript support |
| Accessibility | React Aria | WCAG 2.1 AA compliance |
| Build | Vite | Fast HMR, optimized builds |
| Styling | CSS Modules or Tailwind | Scoped, maintainable |
| Routing | React Router v6 | Standard, type-safe |

### 3.2 Component Structure

```
packages/web/src/
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Dialog.tsx
│   │   ├── Form/ (Input, Select, DatePicker, NumberInput)
│   │   ├── ProgressBar.tsx
│   │   └── Toast.tsx
│   │
│   ├── sprint/
│   │   ├── SprintCard.tsx
│   │   ├── SprintList.tsx
│   │   ├── SprintForm.tsx
│   │   ├── SprintDetail.tsx
│   │   └── SprintStats.tsx
│   │
│   ├── goal/
│   │   ├── GoalCard.tsx
│   │   ├── GoalList.tsx
│   │   ├── GoalForm.tsx
│   │   └── GoalProgress.tsx
│   │
│   ├── criterion/
│   │   ├── CriterionItem.tsx
│   │   ├── CriterionList.tsx
│   │   └── CriterionForm.tsx
│   │
│   └── layout/
│       ├── Header.tsx
│       ├── Navigation.tsx
│       └── MainLayout.tsx
│
├── pages/
│   ├── Dashboard.tsx        # Current sprint overview
│   ├── SprintsPage.tsx      # Sprint list
│   ├── SprintDetailPage.tsx # Single sprint with goals
│   ├── GoalsPage.tsx        # All goals view
│   └── SettingsPage.tsx     # Import/export
│
├── hooks/
│   ├── useSprints.ts
│   ├── useGoals.ts
│   ├── useCriteria.ts
│   └── useStorage.ts
│
└── context/
    ├── StorageContext.tsx
    └── ThemeContext.tsx
```

### 3.3 Accessibility Requirements

The CLI has excellent screen reader support. The browser version must maintain:

| CLI Feature | Web Equivalent |
|-------------|----------------|
| `formatSuccess()` "OK:" prefix | Toast with `role="status"` |
| `formatError()` "ERROR:" prefix | Toast with `role="alert"` |
| Progress bar `[███░░░]` | `<progress>` with `aria-valuenow` |
| Status icons `●/○` | Checkbox with `aria-checked` |
| Tables | Proper `<th scope>` attributes |

**Key requirements:**
- Keyboard navigation for all interactive elements
- 4.5:1 minimum contrast ratio
- Focus indicators on all controls
- Screen reader testing with NVDA/VoiceOver

---

## 4. Build Tooling

### 4.1 Monorepo Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

```json
// package.json (root)
{
  "name": "sprint-tracker-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "dev:cli": "pnpm --filter @sprint-tracker/cli dev",
    "dev:web": "pnpm --filter @sprint-tracker/web dev"
  }
}
```

### 4.2 Core Package

```json
// packages/core/package.json
{
  "name": "@sprint-tracker/core",
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts"
  }
}
```

### 4.3 Web Package

```typescript
// packages/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', sourcemap: true }
});
```

---

## 5. Testing Strategy

| Layer | Framework | Target | Focus |
|-------|-----------|--------|-------|
| Core | Vitest | 100% | Types, validation, services |
| CLI | Jest | 80% | Integration with SQLite |
| Web Components | Vitest + Testing Library | 80% | Rendering, interactions |
| Web E2E | Playwright | Critical paths | User workflows |
| Accessibility | jest-axe + manual | All components | WCAG compliance |

### Mock Storage for Testing

```typescript
export function createMockStorage(): StorageAdapter {
  const sprints = new Map<string, Sprint>();
  const goals = new Map<string, Goal>();
  const criteria = new Map<string, SuccessCriterion>();

  return {
    async createSprint(sprint) { sprints.set(sprint.id, sprint); },
    async getSprintById(id) { return sprints.get(id) ?? null; },
    // ... etc
  };
}
```

---

## 6. Deployment

### 6.1 PWA Configuration

Since all data is in IndexedDB, the app works fully offline:

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sprint Tracker',
        short_name: 'Sprints',
        theme_color: '#1a73e8'
      }
    })
  ]
});
```

### 6.2 Data Import/Export for Browser

```typescript
// Replace file system with browser APIs
export async function exportToFile(data: ExportData): Promise<void> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sprint-tracker-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 7. Implementation Phases

### Phase 1: Foundation
- [ ] Set up monorepo with pnpm workspaces
- [ ] Move types.ts and validation.ts to @sprint-tracker/core
- [ ] Define StorageAdapter interface
- [ ] Create mock storage for testing

### Phase 2: Service Refactoring
- [ ] Convert all services to async + interface pattern
- [ ] Create SQLiteStorage adapter (CLI backward compatibility)
- [ ] Update CLI to use new architecture
- [ ] Verify all existing tests pass

### Phase 3: Browser Storage
- [ ] Implement IndexedDBStorage adapter
- [ ] Write comprehensive IndexedDB tests
- [ ] Implement schema versioning/migrations

### Phase 4: Core UI
- [ ] Set up React + Vite project
- [ ] Implement layout and navigation
- [ ] Create Sprint components (list, detail, form)
- [ ] Create Goal components
- [ ] Create Criterion components

### Phase 5: Accessibility & Polish
- [ ] Accessibility audit with jest-axe
- [ ] Keyboard navigation
- [ ] Screen reader testing
- [ ] Dark mode support
- [ ] Responsive design

### Phase 6: PWA & Deployment
- [ ] PWA configuration
- [ ] Offline testing
- [ ] CI/CD pipeline
- [ ] Production deployment

---

## 8. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| IndexedDB browser differences | High | **Dexie.js handles cross-browser quirks**; test Safari/Firefox/Chrome |
| Bundle size bloat | Medium | Tree-shaking, code splitting, bundle analysis (Dexie.js only adds 25KB) |
| Breaking CLI during refactor | High | Maintain test coverage, staged rollout |
| Accessibility regressions | Medium | Automated a11y tests, manual testing |
| Future need for complex queries | Low | StorageAdapter interface allows swapping to sql.js later if needed |

---

## 9. Key Files Reference

| File | Role | Action |
|------|------|--------|
| `src/types.ts` | Data models | Move unchanged to core |
| `src/validation.ts` | Validation logic | Move unchanged to core |
| `src/services/*.ts` | Business logic | Refactor to async + interface |
| `src/db/database.ts` | SQLite implementation | Create StorageAdapter wrapper |
| `src/cli/formatter.ts` | Output formatting | Port patterns to React |

---

## Summary

This plan enables building a browser version while:
1. **Maximizing code reuse** - Types, validation, and service logic shared
2. **Maintaining backwards compatibility** - CLI continues working
3. **Ensuring accessibility** - Same standards as CLI version
4. **Supporting offline use** - PWA with IndexedDB storage
5. **Enabling future expansion** - Clean interfaces for additional platforms

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

### 2.3 Browser Storage: IndexedDB

**Why IndexedDB:**
| Option | Capacity | Query Support | Async | Decision |
|--------|----------|---------------|-------|----------|
| **IndexedDB** | ~50% disk | Indexes | Yes | ✅ Primary |
| localStorage | 5-10MB | Key-value | No | Settings only |
| sql.js (WASM) | Unlimited | Full SQL | Yes | ❌ 500KB bundle |

**IndexedDB Schema:**
```typescript
const DB_NAME = 'sprint-tracker';
const DB_VERSION = 1;

// Object stores:
// - 'sprints' (keyPath: 'id', indexes: volgnummer, startdatum)
// - 'goals' (keyPath: 'id', indexes: sprint_id, eigenaar)
// - 'criteria' (keyPath: 'id', indexes: goal_id)
```

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
| IndexedDB browser differences | High | Test Safari/Firefox/Chrome; consider Dexie.js wrapper |
| Bundle size bloat | Medium | Tree-shaking, code splitting, bundle analysis |
| Breaking CLI during refactor | High | Maintain test coverage, staged rollout |
| Accessibility regressions | Medium | Automated a11y tests, manual testing |

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

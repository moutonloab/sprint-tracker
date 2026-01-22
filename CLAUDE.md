# CLAUDE.md - Sprint Tracker

This document provides guidance for AI assistants working with this codebase.

## Project Overview

Sprint Tracker is a lightweight sprint tracking tool for 2-week agile cycles. It tracks sprints, goals, success criteria, and retrospectives. The project uses a **monorepo architecture** with shared core logic between CLI and web applications.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Package Manager | pnpm 8.x with workspaces |
| Language | TypeScript 5.x (strict mode) |
| Runtime | Node.js 20.x |
| CLI Framework | Commander.js |
| CLI Database | better-sqlite3 |
| Web Framework | React 18 with React Router v6 |
| Web Database | Dexie.js (IndexedDB wrapper) |
| Web Build | Vite 5.x |
| Testing | Jest (root/CLI), Vitest (core/web) |
| Linting | ESLint with TypeScript rules |
| Deployment | Vercel |

## Repository Structure

```
sprint-tracker/
├── packages/
│   ├── core/                    # @sprint-tracker/core - Shared business logic
│   │   └── src/
│   │       ├── types.ts         # Data models (Sprint, Goal, SuccessCriterion)
│   │       ├── validation.ts    # Input validation functions
│   │       ├── interfaces/
│   │       │   └── storage.ts   # StorageAdapter interface
│   │       ├── services/        # Business logic services
│   │       └── testing/
│   │           └── mock-storage.ts
│   │
│   ├── cli/                     # @sprint-tracker/cli - Command line application
│   │   └── src/
│   │       └── db/
│   │           └── sqlite-storage.ts  # SQLite implementation
│   │
│   └── web/                     # @sprint-tracker/web - Browser application
│       └── src/
│           ├── db/
│           │   └── dexie-storage.ts   # IndexedDB implementation
│           ├── components/      # React components
│           ├── context/         # React context providers
│           └── pages/           # Page components
│
├── src/                         # Legacy CLI source (being migrated)
│   ├── cli/
│   │   └── commands/            # CLI command definitions
│   ├── db/
│   │   └── database.ts          # Legacy database module
│   └── services/                # Legacy services
│
├── tests/                       # Root-level tests (Jest)
├── docs/                        # Documentation
├── tsconfig.base.json           # Shared TypeScript config
├── pnpm-workspace.yaml          # Workspace configuration
└── vercel.json                  # Deployment configuration
```

## Key Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run linting
pnpm lint

# Development
pnpm dev:cli    # Start CLI in dev mode
pnpm dev:web    # Start web app (Vite dev server)

# Clean build artifacts
pnpm clean
```

## Architecture Patterns

### Storage Adapter Pattern

The project uses a storage abstraction layer defined in `packages/core/src/interfaces/storage.ts`:

```typescript
interface StorageAdapter {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Sprint operations
  createSprint(sprint: Sprint): Promise<void>;
  getSprintById(id: string): Promise<Sprint | null>;
  // ... more operations

  // Transaction support
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
```

Two implementations exist:
- `SQLiteStorage` in `packages/cli/src/db/sqlite-storage.ts` - Uses better-sqlite3
- `DexieStorage` in `packages/web/src/db/dexie-storage.ts` - Uses IndexedDB via Dexie.js

### Service Layer

Services accept a `StorageAdapter` via constructor injection:

```typescript
class SprintService {
  constructor(private storage: StorageAdapter) {}

  async create(input: CreateSprintInput): Promise<Sprint> {
    const validation = validateCreateSprint(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    // ... create sprint
  }
}
```

### Validation Pattern

All input validation is in `packages/core/src/validation.ts`. Functions return `ValidationResult`:

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

## Data Model

The data model uses **Dutch naming conventions** for historical reasons:

### Sprint
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `volgnummer` | number | Sprint number (1, 2, 3...) |
| `startdatum` | string | Start date (YYYY-MM-DD) |
| `einddatum` | string | End date (YYYY-MM-DD) |

### Goal
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `sprint_id` | UUID | Reference to Sprint |
| `titel` | string | Title (max 200 chars) |
| `beschrijving` | string | Description (max 2000 chars) |
| `eigenaar` | string | Owner (max 50 chars) |
| `geschatte_uren` | number | Estimated hours (0.25h precision) |
| `werkelijke_uren` | number\|null | Actual hours |
| `behaald` | boolean\|null | Achieved status |
| `toelichting` | string\|null | Notes |
| `geleerde_lessen` | string\|null | Lessons learned |
| `aangemaakt_op` | string | Created timestamp (ISO 8601) |
| `gewijzigd_op` | string | Modified timestamp (ISO 8601) |

### SuccessCriterion
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `goal_id` | UUID | Reference to Goal |
| `beschrijving` | string | Description (max 500 chars) |
| `voltooid` | boolean | Completed status |

## TypeScript Configuration

The project uses strict TypeScript settings. Key compiler options:

```json
{
  "strict": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true,
  "noPropertyAccessFromIndexSignature": true
}
```

Always handle potentially `undefined` array access:
```typescript
// Correct
const first = items[0];
if (first !== undefined) { /* use first */ }

// Or with non-null assertion when you're certain
const today = new Date().toISOString().split('T')[0]!;
```

## ESLint Rules

Key enforced rules:
- `@typescript-eslint/explicit-function-return-type`: Required
- `@typescript-eslint/no-unused-vars`: Error (except `_` prefixed)
- `@typescript-eslint/strict-boolean-expressions`: Required

## Testing Guidelines

### Test Organization

- Root `/tests/` directory uses Jest for legacy tests
- `packages/core/` uses Vitest
- `packages/web/` uses Vitest

### Mock Storage for Testing

Use `createMockStorage()` from `@sprint-tracker/core` for unit tests:

```typescript
import { createMockStorage, SprintService } from '@sprint-tracker/core';

describe('SprintService', () => {
  let storage: StorageAdapter;
  let service: SprintService;

  beforeEach(async () => {
    storage = createMockStorage();
    await storage.initialize();
    service = new SprintService(storage);
  });

  it('should create a sprint', async () => {
    const sprint = await service.create({
      volgnummer: 1,
      startdatum: '2026-01-13',
      einddatum: '2026-01-26',
    });
    expect(sprint.id).toBeDefined();
  });
});
```

## Common Development Tasks

### Adding a New Service Method

1. Add the method signature to the relevant service in `packages/core/src/services/`
2. Implement validation if needed in `packages/core/src/validation.ts`
3. Add tests in the appropriate test file
4. If storage operations are needed, add to `StorageAdapter` interface and both implementations

### Adding a New CLI Command

1. Add command in `src/cli/commands/` or `packages/cli/src/commands/`
2. Register the command in the parent command file
3. Use the formatter functions from `src/cli/formatter.ts` for output

### Adding a New Web Page/Component

1. Create component in `packages/web/src/components/` or page in `packages/web/src/pages/`
2. Add route in `packages/web/src/App.tsx` if it's a page
3. Use `useStorage()` hook from `StorageContext` to access services
4. Follow accessibility patterns (ARIA attributes, keyboard navigation)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SPRINT_TRACKER_DATA_DIR` | Directory for SQLite database | `./data` |

## Database Migrations

### SQLite (CLI)
Schema migrations are in `packages/cli/src/db/sqlite-storage.ts` in the `runMigrations()` function. The `schema_version` table tracks the current version.

### IndexedDB (Web)
Dexie.js handles migrations via version numbers in the database class definition.

## Deployment

The web app deploys to Vercel. Configuration is in `vercel.json`:
- Build command: `pnpm build`
- Output directory: `packages/web/dist`
- SPA routing configured with rewrites

## Code Style Guidelines

1. **No emojis** in code or comments unless explicitly requested
2. **Explicit return types** on all functions
3. **Async/await** preferred over Promise chains
4. **Null checks** required for all optional/nullable values
5. **Dutch field names** are preserved in the data model for backward compatibility
6. **English** for all code, comments, and documentation

## Import/Export Data Format

The JSON export format is shared between CLI and web:

```typescript
interface ExportData {
  version: string;           // "1.0"
  exported_at: string;       // ISO 8601 timestamp
  sprints: SprintWithGoals[]; // Nested: sprints -> goals -> criteria
}
```

Export/import commands:
```bash
# CLI export
sprint-tracker data export -o backup.json

# CLI import
sprint-tracker data import backup.json --overwrite
```

## Useful File Locations

| Purpose | Location |
|---------|----------|
| Type definitions | `packages/core/src/types.ts` |
| Validation rules | `packages/core/src/validation.ts` |
| Storage interface | `packages/core/src/interfaces/storage.ts` |
| Sprint service | `packages/core/src/services/sprint-service.ts` |
| Goal service | `packages/core/src/services/goal-service.ts` |
| CLI entry point | `src/cli/index.ts` |
| Web entry point | `packages/web/src/main.tsx` |
| Web routes | `packages/web/src/App.tsx` |
| SQLite storage | `packages/cli/src/db/sqlite-storage.ts` |
| IndexedDB storage | `packages/web/src/db/dexie-storage.ts` |

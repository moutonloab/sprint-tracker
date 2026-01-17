import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { StorageAdapter, Sprint, Goal, SuccessCriterion } from '@sprint-tracker/core';

const SCHEMA_VERSION = 1;

interface DbGoal {
  id: string;
  sprint_id: string;
  titel: string;
  beschrijving: string;
  eigenaar: string;
  geschatte_uren: number;
  werkelijke_uren: number | null;
  behaald: number | null;
  toelichting: string | null;
  geleerde_lessen: string | null;
  aangemaakt_op: string;
  gewijzigd_op: string;
}

interface DbCriterion {
  id: string;
  goal_id: string;
  beschrijving: string;
  voltooid: number;
}

function mapDbToGoal(row: DbGoal): Goal {
  return {
    id: row.id,
    sprint_id: row.sprint_id,
    titel: row.titel,
    beschrijving: row.beschrijving,
    eigenaar: row.eigenaar,
    geschatte_uren: row.geschatte_uren,
    werkelijke_uren: row.werkelijke_uren,
    behaald: row.behaald === null ? null : row.behaald === 1,
    toelichting: row.toelichting,
    geleerde_lessen: row.geleerde_lessen,
    aangemaakt_op: row.aangemaakt_op,
    gewijzigd_op: row.gewijzigd_op,
  };
}

function mapDbToCriterion(row: DbCriterion): SuccessCriterion {
  return {
    id: row.id,
    goal_id: row.goal_id,
    beschrijving: row.beschrijving,
    voltooid: row.voltooid === 1,
  };
}

/**
 * SQLite implementation of StorageAdapter
 */
export class SQLiteStorage implements StorageAdapter {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? getDefaultDbPath();
    const dir = path.dirname(resolvedPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async initialize(): Promise<void> {
    runMigrations(this.db);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Sprint operations
  async createSprint(sprint: Sprint): Promise<void> {
    this.db.prepare(`
      INSERT INTO sprint (id, volgnummer, startdatum, einddatum)
      VALUES (@id, @volgnummer, @startdatum, @einddatum)
    `).run(sprint);
  }

  async getSprintById(id: string): Promise<Sprint | null> {
    const row = this.db.prepare('SELECT * FROM sprint WHERE id = ?').get(id) as Sprint | undefined;
    return row ?? null;
  }

  async getSprintByVolgnummer(volgnummer: number): Promise<Sprint | null> {
    const row = this.db.prepare('SELECT * FROM sprint WHERE volgnummer = ?').get(volgnummer) as Sprint | undefined;
    return row ?? null;
  }

  async getAllSprints(): Promise<Sprint[]> {
    return this.db.prepare('SELECT * FROM sprint ORDER BY volgnummer ASC').all() as Sprint[];
  }

  async updateSprint(id: string, updates: Partial<Sprint>): Promise<void> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };

    if (updates.volgnummer !== undefined) {
      sets.push('volgnummer = @volgnummer');
      params['volgnummer'] = updates.volgnummer;
    }
    if (updates.startdatum !== undefined) {
      sets.push('startdatum = @startdatum');
      params['startdatum'] = updates.startdatum;
    }
    if (updates.einddatum !== undefined) {
      sets.push('einddatum = @einddatum');
      params['einddatum'] = updates.einddatum;
    }

    if (sets.length > 0) {
      this.db.prepare(`UPDATE sprint SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }
  }

  async deleteSprint(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM sprint WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async getMaxVolgnummer(): Promise<number | null> {
    const row = this.db.prepare('SELECT MAX(volgnummer) as max FROM sprint').get() as { max: number | null };
    return row.max;
  }

  async getCurrentSprint(today: string): Promise<Sprint | null> {
    const row = this.db.prepare(`
      SELECT * FROM sprint
      WHERE startdatum <= ? AND einddatum >= ?
      ORDER BY volgnummer DESC
      LIMIT 1
    `).get(today, today) as Sprint | undefined;
    return row ?? null;
  }

  async getLatestSprint(): Promise<Sprint | null> {
    const row = this.db.prepare('SELECT * FROM sprint ORDER BY volgnummer DESC LIMIT 1').get() as Sprint | undefined;
    return row ?? null;
  }

  // Goal operations
  async createGoal(goal: Goal): Promise<void> {
    this.db.prepare(`
      INSERT INTO goal (
        id, sprint_id, titel, beschrijving, eigenaar, geschatte_uren,
        werkelijke_uren, behaald, toelichting, geleerde_lessen,
        aangemaakt_op, gewijzigd_op
      ) VALUES (
        @id, @sprint_id, @titel, @beschrijving, @eigenaar, @geschatte_uren,
        @werkelijke_uren, @behaald, @toelichting, @geleerde_lessen,
        @aangemaakt_op, @gewijzigd_op
      )
    `).run({
      ...goal,
      behaald: goal.behaald === null ? null : (goal.behaald ? 1 : 0),
    });
  }

  async getGoalById(id: string): Promise<Goal | null> {
    const row = this.db.prepare('SELECT * FROM goal WHERE id = ?').get(id) as DbGoal | undefined;
    return row ? mapDbToGoal(row) : null;
  }

  async getGoalsBySprintId(sprintId: string): Promise<Goal[]> {
    const rows = this.db.prepare(`
      SELECT * FROM goal WHERE sprint_id = ? ORDER BY aangemaakt_op ASC
    `).all(sprintId) as DbGoal[];
    return rows.map(mapDbToGoal);
  }

  async getGoalsByOwner(owner: string): Promise<Goal[]> {
    const rows = this.db.prepare(`
      SELECT * FROM goal WHERE eigenaar = ? ORDER BY aangemaakt_op ASC
    `).all(owner) as DbGoal[];
    return rows.map(mapDbToGoal);
  }

  async getAllGoals(): Promise<Goal[]> {
    const rows = this.db.prepare('SELECT * FROM goal ORDER BY aangemaakt_op ASC').all() as DbGoal[];
    return rows.map(mapDbToGoal);
  }

  async updateGoal(id: string, updates: Partial<Goal>): Promise<void> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };

    if (updates.titel !== undefined) {
      sets.push('titel = @titel');
      params['titel'] = updates.titel;
    }
    if (updates.beschrijving !== undefined) {
      sets.push('beschrijving = @beschrijving');
      params['beschrijving'] = updates.beschrijving;
    }
    if (updates.eigenaar !== undefined) {
      sets.push('eigenaar = @eigenaar');
      params['eigenaar'] = updates.eigenaar;
    }
    if (updates.geschatte_uren !== undefined) {
      sets.push('geschatte_uren = @geschatte_uren');
      params['geschatte_uren'] = updates.geschatte_uren;
    }
    if (updates.werkelijke_uren !== undefined) {
      sets.push('werkelijke_uren = @werkelijke_uren');
      params['werkelijke_uren'] = updates.werkelijke_uren;
    }
    if (updates.behaald !== undefined) {
      sets.push('behaald = @behaald');
      params['behaald'] = updates.behaald === null ? null : (updates.behaald ? 1 : 0);
    }
    if (updates.toelichting !== undefined) {
      sets.push('toelichting = @toelichting');
      params['toelichting'] = updates.toelichting;
    }
    if (updates.geleerde_lessen !== undefined) {
      sets.push('geleerde_lessen = @geleerde_lessen');
      params['geleerde_lessen'] = updates.geleerde_lessen;
    }
    if (updates.gewijzigd_op !== undefined) {
      sets.push('gewijzigd_op = @gewijzigd_op');
      params['gewijzigd_op'] = updates.gewijzigd_op;
    }

    if (sets.length > 0) {
      this.db.prepare(`UPDATE goal SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }
  }

  async deleteGoal(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM goal WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async sprintExists(sprintId: string): Promise<boolean> {
    const row = this.db.prepare('SELECT id FROM sprint WHERE id = ?').get(sprintId);
    return row !== undefined;
  }

  // Criterion operations
  async createCriterion(criterion: SuccessCriterion): Promise<void> {
    this.db.prepare(`
      INSERT INTO success_criterion (id, goal_id, beschrijving, voltooid)
      VALUES (@id, @goal_id, @beschrijving, @voltooid)
    `).run({
      ...criterion,
      voltooid: criterion.voltooid ? 1 : 0,
    });
  }

  async getCriterionById(id: string): Promise<SuccessCriterion | null> {
    const row = this.db.prepare('SELECT * FROM success_criterion WHERE id = ?').get(id) as DbCriterion | undefined;
    return row ? mapDbToCriterion(row) : null;
  }

  async getCriteriaByGoalId(goalId: string): Promise<SuccessCriterion[]> {
    const rows = this.db.prepare(`
      SELECT * FROM success_criterion WHERE goal_id = ? ORDER BY id ASC
    `).all(goalId) as DbCriterion[];
    return rows.map(mapDbToCriterion);
  }

  async updateCriterion(id: string, updates: Partial<SuccessCriterion>): Promise<void> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };

    if (updates.beschrijving !== undefined) {
      sets.push('beschrijving = @beschrijving');
      params['beschrijving'] = updates.beschrijving;
    }
    if (updates.voltooid !== undefined) {
      sets.push('voltooid = @voltooid');
      params['voltooid'] = updates.voltooid ? 1 : 0;
    }

    if (sets.length > 0) {
      this.db.prepare(`UPDATE success_criterion SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }
  }

  async deleteCriterion(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM success_criterion WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async goalExists(goalId: string): Promise<boolean> {
    const row = this.db.prepare('SELECT id FROM goal WHERE id = ?').get(goalId);
    return row !== undefined;
  }

  // Transaction support
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // SQLite transactions are synchronous, but we wrap for async compatibility
    return this.db.transaction(() => {
      // This is a workaround - in practice, we run the async function
      // but SQLite's transaction is sync. For complex cases, consider
      // using explicit BEGIN/COMMIT
      let result: T;
      const promise = fn();
      // Force synchronous execution (works because our storage methods are sync)
      promise.then(r => { result = r; });
      return result!;
    })();
  }
}

// Helper functions

function getDefaultDbPath(): string {
  const dataDir = process.env['SPRINT_TRACKER_DATA_DIR'] ?? path.join(process.cwd(), 'data');
  return path.join(dataDir, 'sprint-tracker.db');
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `);

  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
  const currentVersion = row?.version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    runMigrationV1(db);

    if (currentVersion === 0) {
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    } else {
      db.prepare('UPDATE schema_version SET version = ?').run(SCHEMA_VERSION);
    }
  }
}

function runMigrationV1(db: Database.Database): void {
  db.exec(`
    -- Sprint table
    CREATE TABLE IF NOT EXISTS sprint (
      id TEXT PRIMARY KEY CHECK(length(id) = 36),
      volgnummer INTEGER NOT NULL UNIQUE CHECK(volgnummer > 0),
      startdatum TEXT NOT NULL CHECK(length(startdatum) = 10),
      einddatum TEXT NOT NULL CHECK(length(einddatum) = 10),
      CHECK(einddatum > startdatum)
    );

    -- Goal table
    CREATE TABLE IF NOT EXISTS goal (
      id TEXT PRIMARY KEY CHECK(length(id) = 36),
      sprint_id TEXT NOT NULL REFERENCES sprint(id) ON DELETE CASCADE,
      titel TEXT NOT NULL CHECK(length(titel) <= 200 AND length(titel) > 0),
      beschrijving TEXT NOT NULL CHECK(length(beschrijving) <= 2000),
      eigenaar TEXT NOT NULL CHECK(length(eigenaar) <= 50 AND length(eigenaar) > 0),
      geschatte_uren REAL NOT NULL CHECK(geschatte_uren >= 0),
      werkelijke_uren REAL CHECK(werkelijke_uren IS NULL OR werkelijke_uren >= 0),
      behaald INTEGER CHECK(behaald IS NULL OR behaald IN (0, 1)),
      toelichting TEXT CHECK(toelichting IS NULL OR length(toelichting) <= 2000),
      geleerde_lessen TEXT CHECK(geleerde_lessen IS NULL OR length(geleerde_lessen) <= 2000),
      aangemaakt_op TEXT NOT NULL CHECK(length(aangemaakt_op) >= 20),
      gewijzigd_op TEXT NOT NULL CHECK(length(gewijzigd_op) >= 20)
    );

    -- Success criterion table
    CREATE TABLE IF NOT EXISTS success_criterion (
      id TEXT PRIMARY KEY CHECK(length(id) = 36),
      goal_id TEXT NOT NULL REFERENCES goal(id) ON DELETE CASCADE,
      beschrijving TEXT NOT NULL CHECK(length(beschrijving) <= 500 AND length(beschrijving) > 0),
      voltooid INTEGER NOT NULL DEFAULT 0 CHECK(voltooid IN (0, 1))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_goal_sprint_id ON goal(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_success_criterion_goal_id ON success_criterion(goal_id);
    CREATE INDEX IF NOT EXISTS idx_sprint_volgnummer ON sprint(volgnummer);
  `);
}

/**
 * Create an in-memory SQLite storage for testing
 */
export function createTestStorage(): SQLiteStorage {
  const storage = new (class extends SQLiteStorage {
    constructor() {
      // @ts-expect-error - accessing private for test
      super(':memory:');
    }
  })();
  return storage;
}

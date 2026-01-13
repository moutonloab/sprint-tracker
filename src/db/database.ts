import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

const SCHEMA_VERSION = 1;

/**
 * Get the default database path
 */
export function getDefaultDbPath(): string {
  const dataDir = process.env['SPRINT_TRACKER_DATA_DIR'] ?? path.join(process.cwd(), 'data');
  return path.join(dataDir, 'sprint-tracker.db');
}

/**
 * Initialize the database connection
 */
export function initDatabase(dbPath?: string): Database.Database {
  if (db !== null) {
    return db;
  }

  const resolvedPath = dbPath ?? getDefaultDbPath();
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  return db;
}

/**
 * Get the current database instance
 */
export function getDatabase(): Database.Database {
  if (db === null) {
    return initDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db !== null) {
    db.close();
    db = null;
  }
}

/**
 * Run database migrations
 */
function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `);

  const row = database.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
  const currentVersion = row?.version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    runMigrationV1(database);

    if (currentVersion === 0) {
      database.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    } else {
      database.prepare('UPDATE schema_version SET version = ?').run(SCHEMA_VERSION);
    }
  }
}

/**
 * Migration v1: Initial schema
 */
function runMigrationV1(database: Database.Database): void {
  database.exec(`
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
 * Reset database for testing
 */
export function resetDatabase(): void {
  if (db !== null) {
    db.exec(`
      DELETE FROM success_criterion;
      DELETE FROM goal;
      DELETE FROM sprint;
    `);
  }
}

/**
 * Create an in-memory database for testing
 */
export function createTestDatabase(): Database.Database {
  const testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');

  // Create schema_version table first
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `);

  runMigrationV1(testDb);
  testDb.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
  return testDb;
}

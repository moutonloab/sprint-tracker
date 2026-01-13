import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { Sprint, CreateSprintInput, UpdateSprintInput } from '../types';
import { validateCreateSprint, validateUpdateSprint, isValidUUID } from '../validation';
import { getDatabase } from '../db/database';

interface DbSprint {
  id: string;
  volgnummer: number;
  startdatum: string;
  einddatum: string;
}

function mapDbToSprint(row: DbSprint): Sprint {
  return {
    id: row.id,
    volgnummer: row.volgnummer,
    startdatum: row.startdatum,
    einddatum: row.einddatum,
  };
}

export class SprintService {
  private db: Database.Database;

  constructor(database?: Database.Database) {
    this.db = database ?? getDatabase();
  }

  /**
   * Create a new sprint
   */
  create(input: CreateSprintInput): Sprint {
    const validation = validateCreateSprint(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const id = uuidv4();
    const sprint: Sprint = {
      id,
      volgnummer: input.volgnummer,
      startdatum: input.startdatum,
      einddatum: input.einddatum,
    };

    const stmt = this.db.prepare(`
      INSERT INTO sprint (id, volgnummer, startdatum, einddatum)
      VALUES (@id, @volgnummer, @startdatum, @einddatum)
    `);

    stmt.run(sprint);

    return sprint;
  }

  /**
   * Get a sprint by ID
   */
  getById(id: string): Sprint | null {
    if (!isValidUUID(id)) {
      throw new Error('Invalid sprint ID format');
    }

    const row = this.db.prepare('SELECT * FROM sprint WHERE id = ?').get(id) as DbSprint | undefined;
    return row !== undefined ? mapDbToSprint(row) : null;
  }

  /**
   * Get a sprint by volgnummer
   */
  getByVolgnummer(volgnummer: number): Sprint | null {
    const row = this.db.prepare('SELECT * FROM sprint WHERE volgnummer = ?').get(volgnummer) as DbSprint | undefined;
    return row !== undefined ? mapDbToSprint(row) : null;
  }

  /**
   * Get all sprints ordered by volgnummer
   */
  getAll(): Sprint[] {
    const rows = this.db.prepare('SELECT * FROM sprint ORDER BY volgnummer ASC').all() as DbSprint[];
    return rows.map(mapDbToSprint);
  }

  /**
   * Get the current sprint (based on today's date)
   */
  getCurrent(): Sprint | null {
    const today = new Date().toISOString().split('T')[0];
    const row = this.db.prepare(`
      SELECT * FROM sprint
      WHERE startdatum <= ? AND einddatum >= ?
      ORDER BY volgnummer DESC
      LIMIT 1
    `).get(today, today) as DbSprint | undefined;
    return row !== undefined ? mapDbToSprint(row) : null;
  }

  /**
   * Get the latest sprint
   */
  getLatest(): Sprint | null {
    const row = this.db.prepare('SELECT * FROM sprint ORDER BY volgnummer DESC LIMIT 1').get() as DbSprint | undefined;
    return row !== undefined ? mapDbToSprint(row) : null;
  }

  /**
   * Update a sprint
   */
  update(id: string, input: UpdateSprintInput): Sprint {
    if (!isValidUUID(id)) {
      throw new Error('Invalid sprint ID format');
    }

    const validation = validateUpdateSprint(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const existing = this.getById(id);
    if (existing === null) {
      throw new Error(`Sprint with ID ${id} not found`);
    }

    const updates: string[] = [];
    const params: Record<string, unknown> = { id };

    if (input.volgnummer !== undefined) {
      updates.push('volgnummer = @volgnummer');
      params['volgnummer'] = input.volgnummer;
    }
    if (input.startdatum !== undefined) {
      updates.push('startdatum = @startdatum');
      params['startdatum'] = input.startdatum;
    }
    if (input.einddatum !== undefined) {
      updates.push('einddatum = @einddatum');
      params['einddatum'] = input.einddatum;
    }

    if (updates.length > 0) {
      const sql = `UPDATE sprint SET ${updates.join(', ')} WHERE id = @id`;
      this.db.prepare(sql).run(params);
    }

    return this.getById(id)!;
  }

  /**
   * Delete a sprint (cascades to goals and criteria)
   */
  delete(id: string): boolean {
    if (!isValidUUID(id)) {
      throw new Error('Invalid sprint ID format');
    }

    const result = this.db.prepare('DELETE FROM sprint WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Get the next available volgnummer
   */
  getNextVolgnummer(): number {
    const row = this.db.prepare('SELECT MAX(volgnummer) as max FROM sprint').get() as { max: number | null };
    return (row.max ?? 0) + 1;
  }

  /**
   * Calculate suggested dates for next sprint (2-week cycle)
   */
  getSuggestedNextDates(): { startdatum: string; einddatum: string } {
    const latest = this.getLatest();

    let startDate: Date;
    if (latest !== null) {
      startDate = new Date(latest.einddatum);
      startDate.setDate(startDate.getDate() + 1);
    } else {
      startDate = new Date();
      const day = startDate.getDay();
      const diff = day === 0 ? 1 : (day === 6 ? 2 : 0);
      startDate.setDate(startDate.getDate() + diff);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 13);

    return {
      startdatum: startDate.toISOString().split('T')[0]!,
      einddatum: endDate.toISOString().split('T')[0]!,
    };
  }
}

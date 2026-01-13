import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { Goal, CreateGoalInput, UpdateGoalInput } from '../types';
import { validateCreateGoal, validateUpdateGoal, isValidUUID } from '../validation';
import { getDatabase } from '../db/database';

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

export class GoalService {
  private db: Database.Database;

  constructor(database?: Database.Database) {
    this.db = database ?? getDatabase();
  }

  /**
   * Create a new goal
   */
  create(input: CreateGoalInput): Goal {
    const validation = validateCreateGoal(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const sprintExists = this.db.prepare('SELECT id FROM sprint WHERE id = ?').get(input.sprint_id);
    if (sprintExists === undefined) {
      throw new Error(`Sprint with ID ${input.sprint_id} not found`);
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    const stmt = this.db.prepare(`
      INSERT INTO goal (
        id, sprint_id, titel, beschrijving, eigenaar, geschatte_uren,
        werkelijke_uren, behaald, toelichting, geleerde_lessen,
        aangemaakt_op, gewijzigd_op
      ) VALUES (
        @id, @sprint_id, @titel, @beschrijving, @eigenaar, @geschatte_uren,
        NULL, NULL, NULL, NULL, @aangemaakt_op, @gewijzigd_op
      )
    `);

    stmt.run({
      id,
      sprint_id: input.sprint_id,
      titel: input.titel,
      beschrijving: input.beschrijving,
      eigenaar: input.eigenaar,
      geschatte_uren: input.geschatte_uren,
      aangemaakt_op: now,
      gewijzigd_op: now,
    });

    return this.getById(id)!;
  }

  /**
   * Get a goal by ID
   */
  getById(id: string): Goal | null {
    if (!isValidUUID(id)) {
      throw new Error('Invalid goal ID format');
    }

    const row = this.db.prepare('SELECT * FROM goal WHERE id = ?').get(id) as DbGoal | undefined;
    return row !== undefined ? mapDbToGoal(row) : null;
  }

  /**
   * Get all goals for a sprint
   */
  getBySprintId(sprintId: string): Goal[] {
    if (!isValidUUID(sprintId)) {
      throw new Error('Invalid sprint ID format');
    }

    const rows = this.db.prepare(`
      SELECT * FROM goal WHERE sprint_id = ? ORDER BY aangemaakt_op ASC
    `).all(sprintId) as DbGoal[];

    return rows.map(mapDbToGoal);
  }

  /**
   * Get all goals
   */
  getAll(): Goal[] {
    const rows = this.db.prepare('SELECT * FROM goal ORDER BY aangemaakt_op ASC').all() as DbGoal[];
    return rows.map(mapDbToGoal);
  }

  /**
   * Get goals by owner
   */
  getByOwner(eigenaar: string): Goal[] {
    const rows = this.db.prepare(`
      SELECT * FROM goal WHERE eigenaar = ? ORDER BY aangemaakt_op ASC
    `).all(eigenaar) as DbGoal[];

    return rows.map(mapDbToGoal);
  }

  /**
   * Update a goal
   */
  update(id: string, input: UpdateGoalInput): Goal {
    if (!isValidUUID(id)) {
      throw new Error('Invalid goal ID format');
    }

    const validation = validateUpdateGoal(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const existing = this.getById(id);
    if (existing === null) {
      throw new Error(`Goal with ID ${id} not found`);
    }

    const updates: string[] = ['gewijzigd_op = @gewijzigd_op'];
    const params: Record<string, unknown> = {
      id,
      gewijzigd_op: new Date().toISOString(),
    };

    if (input.titel !== undefined) {
      updates.push('titel = @titel');
      params['titel'] = input.titel;
    }
    if (input.beschrijving !== undefined) {
      updates.push('beschrijving = @beschrijving');
      params['beschrijving'] = input.beschrijving;
    }
    if (input.eigenaar !== undefined) {
      updates.push('eigenaar = @eigenaar');
      params['eigenaar'] = input.eigenaar;
    }
    if (input.geschatte_uren !== undefined) {
      updates.push('geschatte_uren = @geschatte_uren');
      params['geschatte_uren'] = input.geschatte_uren;
    }
    if (input.werkelijke_uren !== undefined) {
      updates.push('werkelijke_uren = @werkelijke_uren');
      params['werkelijke_uren'] = input.werkelijke_uren;
    }
    if (input.behaald !== undefined) {
      updates.push('behaald = @behaald');
      params['behaald'] = input.behaald === null ? null : (input.behaald ? 1 : 0);
    }
    if (input.toelichting !== undefined) {
      updates.push('toelichting = @toelichting');
      params['toelichting'] = input.toelichting;
    }
    if (input.geleerde_lessen !== undefined) {
      updates.push('geleerde_lessen = @geleerde_lessen');
      params['geleerde_lessen'] = input.geleerde_lessen;
    }

    const sql = `UPDATE goal SET ${updates.join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run(params);

    return this.getById(id)!;
  }

  /**
   * Mark a goal as achieved or not
   */
  markAchieved(id: string, behaald: boolean, toelichting?: string, geleerde_lessen?: string): Goal {
    return this.update(id, {
      behaald,
      toelichting: toelichting ?? null,
      geleerde_lessen: geleerde_lessen ?? null,
    });
  }

  /**
   * Log actual hours spent
   */
  logHours(id: string, werkelijke_uren: number): Goal {
    return this.update(id, { werkelijke_uren });
  }

  /**
   * Delete a goal (cascades to criteria)
   */
  delete(id: string): boolean {
    if (!isValidUUID(id)) {
      throw new Error('Invalid goal ID format');
    }

    const result = this.db.prepare('DELETE FROM goal WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Get sprint statistics
   */
  getSprintStats(sprintId: string): {
    totalGoals: number;
    completedGoals: number;
    estimatedHours: number;
    actualHours: number;
  } {
    const goals = this.getBySprintId(sprintId);

    return {
      totalGoals: goals.length,
      completedGoals: goals.filter(g => g.behaald === true).length,
      estimatedHours: goals.reduce((sum, g) => sum + g.geschatte_uren, 0),
      actualHours: goals.reduce((sum, g) => sum + (g.werkelijke_uren ?? 0), 0),
    };
  }
}

import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { SuccessCriterion, CreateSuccessCriterionInput, UpdateSuccessCriterionInput } from '../types';
import { validateCreateSuccessCriterion, validateUpdateSuccessCriterion, isValidUUID } from '../validation';
import { getDatabase } from '../db/database';

interface DbCriterion {
  id: string;
  goal_id: string;
  beschrijving: string;
  voltooid: number;
}

function mapDbToCriterion(row: DbCriterion): SuccessCriterion {
  return {
    id: row.id,
    goal_id: row.goal_id,
    beschrijving: row.beschrijving,
    voltooid: row.voltooid === 1,
  };
}

export class CriterionService {
  private db: Database.Database;

  constructor(database?: Database.Database) {
    this.db = database ?? getDatabase();
  }

  /**
   * Create a new success criterion
   */
  create(input: CreateSuccessCriterionInput): SuccessCriterion {
    const validation = validateCreateSuccessCriterion(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const goalExists = this.db.prepare('SELECT id FROM goal WHERE id = ?').get(input.goal_id);
    if (goalExists === undefined) {
      throw new Error(`Goal with ID ${input.goal_id} not found`);
    }

    const id = uuidv4();

    const stmt = this.db.prepare(`
      INSERT INTO success_criterion (id, goal_id, beschrijving, voltooid)
      VALUES (@id, @goal_id, @beschrijving, 0)
    `);

    stmt.run({
      id,
      goal_id: input.goal_id,
      beschrijving: input.beschrijving,
    });

    return this.getById(id)!;
  }

  /**
   * Create multiple criteria at once
   */
  createMany(goalId: string, beschrijvingen: string[]): SuccessCriterion[] {
    if (!isValidUUID(goalId)) {
      throw new Error('Invalid goal ID format');
    }

    const goalExists = this.db.prepare('SELECT id FROM goal WHERE id = ?').get(goalId);
    if (goalExists === undefined) {
      throw new Error(`Goal with ID ${goalId} not found`);
    }

    const stmt = this.db.prepare(`
      INSERT INTO success_criterion (id, goal_id, beschrijving, voltooid)
      VALUES (@id, @goal_id, @beschrijving, 0)
    `);

    const insertMany = this.db.transaction((items: string[]) => {
      const results: SuccessCriterion[] = [];
      for (const beschrijving of items) {
        const validation = validateCreateSuccessCriterion({ goal_id: goalId, beschrijving });
        if (!validation.valid) {
          throw new Error(`Validation failed for criterion: ${validation.errors.join(', ')}`);
        }

        const id = uuidv4();
        stmt.run({ id, goal_id: goalId, beschrijving });
        results.push(this.getById(id)!);
      }
      return results;
    });

    return insertMany(beschrijvingen);
  }

  /**
   * Get a criterion by ID
   */
  getById(id: string): SuccessCriterion | null {
    if (!isValidUUID(id)) {
      throw new Error('Invalid criterion ID format');
    }

    const row = this.db.prepare('SELECT * FROM success_criterion WHERE id = ?').get(id) as DbCriterion | undefined;
    return row !== undefined ? mapDbToCriterion(row) : null;
  }

  /**
   * Get all criteria for a goal
   */
  getByGoalId(goalId: string): SuccessCriterion[] {
    if (!isValidUUID(goalId)) {
      throw new Error('Invalid goal ID format');
    }

    const rows = this.db.prepare(`
      SELECT * FROM success_criterion WHERE goal_id = ? ORDER BY id ASC
    `).all(goalId) as DbCriterion[];

    return rows.map(mapDbToCriterion);
  }

  /**
   * Update a criterion
   */
  update(id: string, input: UpdateSuccessCriterionInput): SuccessCriterion {
    if (!isValidUUID(id)) {
      throw new Error('Invalid criterion ID format');
    }

    const validation = validateUpdateSuccessCriterion(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const existing = this.getById(id);
    if (existing === null) {
      throw new Error(`Criterion with ID ${id} not found`);
    }

    const updates: string[] = [];
    const params: Record<string, unknown> = { id };

    if (input.beschrijving !== undefined) {
      updates.push('beschrijving = @beschrijving');
      params['beschrijving'] = input.beschrijving;
    }
    if (input.voltooid !== undefined) {
      updates.push('voltooid = @voltooid');
      params['voltooid'] = input.voltooid ? 1 : 0;
    }

    if (updates.length > 0) {
      const sql = `UPDATE success_criterion SET ${updates.join(', ')} WHERE id = @id`;
      this.db.prepare(sql).run(params);
    }

    return this.getById(id)!;
  }

  /**
   * Toggle criterion completion status
   */
  toggle(id: string): SuccessCriterion {
    const existing = this.getById(id);
    if (existing === null) {
      throw new Error(`Criterion with ID ${id} not found`);
    }
    return this.update(id, { voltooid: !existing.voltooid });
  }

  /**
   * Mark criterion as complete
   */
  complete(id: string): SuccessCriterion {
    return this.update(id, { voltooid: true });
  }

  /**
   * Mark criterion as incomplete
   */
  uncomplete(id: string): SuccessCriterion {
    return this.update(id, { voltooid: false });
  }

  /**
   * Delete a criterion
   */
  delete(id: string): boolean {
    if (!isValidUUID(id)) {
      throw new Error('Invalid criterion ID format');
    }

    const result = this.db.prepare('DELETE FROM success_criterion WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Get completion progress for a goal
   */
  getProgress(goalId: string): { total: number; completed: number; percentage: number } {
    const criteria = this.getByGoalId(goalId);
    const completed = criteria.filter(c => c.voltooid).length;
    const total = criteria.length;

    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}

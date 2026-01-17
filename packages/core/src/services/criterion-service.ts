import { v4 as uuidv4 } from 'uuid';
import { SuccessCriterion, CreateSuccessCriterionInput, UpdateSuccessCriterionInput } from '../types';
import { validateCreateSuccessCriterion, validateUpdateSuccessCriterion, isValidUUID } from '../validation';
import { StorageAdapter } from '../interfaces/storage';

export class CriterionService {
  constructor(private storage: StorageAdapter) {}

  /**
   * Create a new success criterion
   */
  async create(input: CreateSuccessCriterionInput): Promise<SuccessCriterion> {
    const validation = validateCreateSuccessCriterion(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const goalExists = await this.storage.goalExists(input.goal_id);
    if (!goalExists) {
      throw new Error(`Goal with ID ${input.goal_id} not found`);
    }

    const id = uuidv4();
    const criterion: SuccessCriterion = {
      id,
      goal_id: input.goal_id,
      beschrijving: input.beschrijving,
      voltooid: false,
    };

    await this.storage.createCriterion(criterion);
    return criterion;
  }

  /**
   * Create multiple criteria at once
   */
  async createMany(goalId: string, beschrijvingen: string[]): Promise<SuccessCriterion[]> {
    if (!isValidUUID(goalId)) {
      throw new Error('Invalid goal ID format');
    }

    const goalExists = await this.storage.goalExists(goalId);
    if (!goalExists) {
      throw new Error(`Goal with ID ${goalId} not found`);
    }

    return this.storage.transaction(async () => {
      const results: SuccessCriterion[] = [];
      for (const beschrijving of beschrijvingen) {
        const validation = validateCreateSuccessCriterion({ goal_id: goalId, beschrijving });
        if (!validation.valid) {
          throw new Error(`Validation failed for criterion: ${validation.errors.join(', ')}`);
        }

        const id = uuidv4();
        const criterion: SuccessCriterion = {
          id,
          goal_id: goalId,
          beschrijving,
          voltooid: false,
        };

        await this.storage.createCriterion(criterion);
        results.push(criterion);
      }
      return results;
    });
  }

  /**
   * Get a criterion by ID
   */
  async getById(id: string): Promise<SuccessCriterion | null> {
    if (!isValidUUID(id)) {
      throw new Error('Invalid criterion ID format');
    }
    return this.storage.getCriterionById(id);
  }

  /**
   * Get all criteria for a goal
   */
  async getByGoalId(goalId: string): Promise<SuccessCriterion[]> {
    if (!isValidUUID(goalId)) {
      throw new Error('Invalid goal ID format');
    }
    return this.storage.getCriteriaByGoalId(goalId);
  }

  /**
   * Update a criterion
   */
  async update(id: string, input: UpdateSuccessCriterionInput): Promise<SuccessCriterion> {
    if (!isValidUUID(id)) {
      throw new Error('Invalid criterion ID format');
    }

    const validation = validateUpdateSuccessCriterion(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const existing = await this.getById(id);
    if (existing === null) {
      throw new Error(`Criterion with ID ${id} not found`);
    }

    const updates: Partial<SuccessCriterion> = {};
    if (input.beschrijving !== undefined) updates.beschrijving = input.beschrijving;
    if (input.voltooid !== undefined) updates.voltooid = input.voltooid;

    if (Object.keys(updates).length > 0) {
      await this.storage.updateCriterion(id, updates);
    }

    return (await this.getById(id))!;
  }

  /**
   * Toggle criterion completion status
   */
  async toggle(id: string): Promise<SuccessCriterion> {
    const existing = await this.getById(id);
    if (existing === null) {
      throw new Error(`Criterion with ID ${id} not found`);
    }
    return this.update(id, { voltooid: !existing.voltooid });
  }

  /**
   * Mark criterion as complete
   */
  async complete(id: string): Promise<SuccessCriterion> {
    return this.update(id, { voltooid: true });
  }

  /**
   * Mark criterion as incomplete
   */
  async uncomplete(id: string): Promise<SuccessCriterion> {
    return this.update(id, { voltooid: false });
  }

  /**
   * Delete a criterion
   */
  async delete(id: string): Promise<boolean> {
    if (!isValidUUID(id)) {
      throw new Error('Invalid criterion ID format');
    }
    return this.storage.deleteCriterion(id);
  }

  /**
   * Get completion progress for a goal
   */
  async getProgress(goalId: string): Promise<{ total: number; completed: number; percentage: number }> {
    const criteria = await this.getByGoalId(goalId);
    const completed = criteria.filter(c => c.voltooid).length;
    const total = criteria.length;

    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}

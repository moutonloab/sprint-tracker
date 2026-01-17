import { v4 as uuidv4 } from 'uuid';
import { Goal, CreateGoalInput, UpdateGoalInput } from '../types';
import { validateCreateGoal, validateUpdateGoal, isValidUUID } from '../validation';
import { StorageAdapter } from '../interfaces/storage';

export class GoalService {
  constructor(private storage: StorageAdapter) {}

  /**
   * Create a new goal
   */
  async create(input: CreateGoalInput): Promise<Goal> {
    const validation = validateCreateGoal(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const sprintExists = await this.storage.sprintExists(input.sprint_id);
    if (!sprintExists) {
      throw new Error(`Sprint with ID ${input.sprint_id} not found`);
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    const goal: Goal = {
      id,
      sprint_id: input.sprint_id,
      titel: input.titel,
      beschrijving: input.beschrijving,
      eigenaar: input.eigenaar,
      geschatte_uren: input.geschatte_uren,
      werkelijke_uren: null,
      behaald: null,
      toelichting: null,
      geleerde_lessen: null,
      aangemaakt_op: now,
      gewijzigd_op: now,
    };

    await this.storage.createGoal(goal);
    return goal;
  }

  /**
   * Get a goal by ID
   */
  async getById(id: string): Promise<Goal | null> {
    if (!isValidUUID(id)) {
      throw new Error('Invalid goal ID format');
    }
    return this.storage.getGoalById(id);
  }

  /**
   * Get all goals for a sprint
   */
  async getBySprintId(sprintId: string): Promise<Goal[]> {
    if (!isValidUUID(sprintId)) {
      throw new Error('Invalid sprint ID format');
    }
    return this.storage.getGoalsBySprintId(sprintId);
  }

  /**
   * Get all goals
   */
  async getAll(): Promise<Goal[]> {
    return this.storage.getAllGoals();
  }

  /**
   * Get goals by owner
   */
  async getByOwner(eigenaar: string): Promise<Goal[]> {
    return this.storage.getGoalsByOwner(eigenaar);
  }

  /**
   * Update a goal
   */
  async update(id: string, input: UpdateGoalInput): Promise<Goal> {
    if (!isValidUUID(id)) {
      throw new Error('Invalid goal ID format');
    }

    const validation = validateUpdateGoal(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const existing = await this.getById(id);
    if (existing === null) {
      throw new Error(`Goal with ID ${id} not found`);
    }

    const updates: Partial<Goal> = {
      gewijzigd_op: new Date().toISOString(),
    };

    if (input.titel !== undefined) updates.titel = input.titel;
    if (input.beschrijving !== undefined) updates.beschrijving = input.beschrijving;
    if (input.eigenaar !== undefined) updates.eigenaar = input.eigenaar;
    if (input.geschatte_uren !== undefined) updates.geschatte_uren = input.geschatte_uren;
    if (input.werkelijke_uren !== undefined) updates.werkelijke_uren = input.werkelijke_uren;
    if (input.behaald !== undefined) updates.behaald = input.behaald;
    if (input.toelichting !== undefined) updates.toelichting = input.toelichting;
    if (input.geleerde_lessen !== undefined) updates.geleerde_lessen = input.geleerde_lessen;

    await this.storage.updateGoal(id, updates);
    return (await this.getById(id))!;
  }

  /**
   * Mark a goal as achieved or not
   */
  async markAchieved(id: string, behaald: boolean, toelichting?: string, geleerde_lessen?: string): Promise<Goal> {
    return this.update(id, {
      behaald,
      toelichting: toelichting ?? null,
      geleerde_lessen: geleerde_lessen ?? null,
    });
  }

  /**
   * Log actual hours spent
   */
  async logHours(id: string, werkelijke_uren: number): Promise<Goal> {
    return this.update(id, { werkelijke_uren });
  }

  /**
   * Delete a goal (cascades to criteria)
   */
  async delete(id: string): Promise<boolean> {
    if (!isValidUUID(id)) {
      throw new Error('Invalid goal ID format');
    }
    return this.storage.deleteGoal(id);
  }

  /**
   * Get sprint statistics
   */
  async getSprintStats(sprintId: string): Promise<{
    totalGoals: number;
    completedGoals: number;
    estimatedHours: number;
    actualHours: number;
  }> {
    const goals = await this.getBySprintId(sprintId);

    return {
      totalGoals: goals.length,
      completedGoals: goals.filter(g => g.behaald === true).length,
      estimatedHours: goals.reduce((sum, g) => sum + g.geschatte_uren, 0),
      actualHours: goals.reduce((sum, g) => sum + (g.werkelijke_uren ?? 0), 0),
    };
  }
}

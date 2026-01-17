import { Sprint, Goal, SuccessCriterion } from '../types';

/**
 * Storage adapter interface for database operations.
 * Implementations must be async to support both sync (SQLite) and async (IndexedDB) backends.
 */
export interface StorageAdapter {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Sprint operations
  createSprint(sprint: Sprint): Promise<void>;
  getSprintById(id: string): Promise<Sprint | null>;
  getSprintByVolgnummer(volgnummer: number): Promise<Sprint | null>;
  getAllSprints(): Promise<Sprint[]>;
  updateSprint(id: string, updates: Partial<Sprint>): Promise<void>;
  deleteSprint(id: string): Promise<boolean>;
  getMaxVolgnummer(): Promise<number | null>;
  getCurrentSprint(today: string): Promise<Sprint | null>;
  getLatestSprint(): Promise<Sprint | null>;

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
}

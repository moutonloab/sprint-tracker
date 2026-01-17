import { StorageAdapter } from '../interfaces/storage';
import { Sprint, Goal, SuccessCriterion } from '../types';

/**
 * In-memory mock implementation of StorageAdapter for testing.
 */
export function createMockStorage(): StorageAdapter {
  const sprints = new Map<string, Sprint>();
  const goals = new Map<string, Goal>();
  const criteria = new Map<string, SuccessCriterion>();

  return {
    async initialize(): Promise<void> {
      // No-op for mock
    },

    async close(): Promise<void> {
      // No-op for mock
    },

    // Sprint operations
    async createSprint(sprint: Sprint): Promise<void> {
      sprints.set(sprint.id, { ...sprint });
    },

    async getSprintById(id: string): Promise<Sprint | null> {
      return sprints.get(id) ?? null;
    },

    async getSprintByVolgnummer(volgnummer: number): Promise<Sprint | null> {
      for (const sprint of sprints.values()) {
        if (sprint.volgnummer === volgnummer) {
          return sprint;
        }
      }
      return null;
    },

    async getAllSprints(): Promise<Sprint[]> {
      return Array.from(sprints.values()).sort((a, b) => a.volgnummer - b.volgnummer);
    },

    async updateSprint(id: string, updates: Partial<Sprint>): Promise<void> {
      const existing = sprints.get(id);
      if (existing) {
        sprints.set(id, { ...existing, ...updates });
      }
    },

    async deleteSprint(id: string): Promise<boolean> {
      // Cascade delete goals and criteria
      for (const goal of goals.values()) {
        if (goal.sprint_id === id) {
          for (const criterion of criteria.values()) {
            if (criterion.goal_id === goal.id) {
              criteria.delete(criterion.id);
            }
          }
          goals.delete(goal.id);
        }
      }
      return sprints.delete(id);
    },

    async getMaxVolgnummer(): Promise<number | null> {
      let max: number | null = null;
      for (const sprint of sprints.values()) {
        if (max === null || sprint.volgnummer > max) {
          max = sprint.volgnummer;
        }
      }
      return max;
    },

    async getCurrentSprint(today: string): Promise<Sprint | null> {
      for (const sprint of sprints.values()) {
        if (sprint.startdatum <= today && sprint.einddatum >= today) {
          return sprint;
        }
      }
      return null;
    },

    async getLatestSprint(): Promise<Sprint | null> {
      let latest: Sprint | null = null;
      for (const sprint of sprints.values()) {
        if (latest === null || sprint.volgnummer > latest.volgnummer) {
          latest = sprint;
        }
      }
      return latest;
    },

    // Goal operations
    async createGoal(goal: Goal): Promise<void> {
      goals.set(goal.id, { ...goal });
    },

    async getGoalById(id: string): Promise<Goal | null> {
      return goals.get(id) ?? null;
    },

    async getGoalsBySprintId(sprintId: string): Promise<Goal[]> {
      return Array.from(goals.values())
        .filter(g => g.sprint_id === sprintId)
        .sort((a, b) => a.aangemaakt_op.localeCompare(b.aangemaakt_op));
    },

    async getGoalsByOwner(owner: string): Promise<Goal[]> {
      return Array.from(goals.values())
        .filter(g => g.eigenaar === owner)
        .sort((a, b) => a.aangemaakt_op.localeCompare(b.aangemaakt_op));
    },

    async getAllGoals(): Promise<Goal[]> {
      return Array.from(goals.values())
        .sort((a, b) => a.aangemaakt_op.localeCompare(b.aangemaakt_op));
    },

    async updateGoal(id: string, updates: Partial<Goal>): Promise<void> {
      const existing = goals.get(id);
      if (existing) {
        goals.set(id, { ...existing, ...updates });
      }
    },

    async deleteGoal(id: string): Promise<boolean> {
      // Cascade delete criteria
      for (const criterion of criteria.values()) {
        if (criterion.goal_id === id) {
          criteria.delete(criterion.id);
        }
      }
      return goals.delete(id);
    },

    async sprintExists(sprintId: string): Promise<boolean> {
      return sprints.has(sprintId);
    },

    // Criterion operations
    async createCriterion(criterion: SuccessCriterion): Promise<void> {
      criteria.set(criterion.id, { ...criterion });
    },

    async getCriterionById(id: string): Promise<SuccessCriterion | null> {
      return criteria.get(id) ?? null;
    },

    async getCriteriaByGoalId(goalId: string): Promise<SuccessCriterion[]> {
      return Array.from(criteria.values())
        .filter(c => c.goal_id === goalId);
    },

    async updateCriterion(id: string, updates: Partial<SuccessCriterion>): Promise<void> {
      const existing = criteria.get(id);
      if (existing) {
        criteria.set(id, { ...existing, ...updates });
      }
    },

    async deleteCriterion(id: string): Promise<boolean> {
      return criteria.delete(id);
    },

    async goalExists(goalId: string): Promise<boolean> {
      return goals.has(goalId);
    },

    // Transaction support (mock just executes the function)
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    },
  };
}

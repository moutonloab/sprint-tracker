import Dexie, { Table } from 'dexie';
import { StorageAdapter, Sprint, Goal, SuccessCriterion } from '@sprint-tracker/core';

/**
 * Dexie database class for Sprint Tracker
 */
class SprintTrackerDB extends Dexie {
  sprints!: Table<Sprint, string>;
  goals!: Table<Goal, string>;
  criteria!: Table<SuccessCriterion, string>;

  constructor() {
    super('sprint-tracker');

    this.version(1).stores({
      sprints: 'id, volgnummer, startdatum, einddatum',
      goals: 'id, sprint_id, eigenaar, aangemaakt_op',
      criteria: 'id, goal_id',
    });
  }
}

/**
 * Dexie/IndexedDB implementation of StorageAdapter for browser
 */
export class DexieStorage implements StorageAdapter {
  private db: SprintTrackerDB;

  constructor() {
    this.db = new SprintTrackerDB();
  }

  async initialize(): Promise<void> {
    await this.db.open();
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Sprint operations
  async createSprint(sprint: Sprint): Promise<void> {
    await this.db.sprints.add(sprint);
  }

  async getSprintById(id: string): Promise<Sprint | null> {
    const sprint = await this.db.sprints.get(id);
    return sprint ?? null;
  }

  async getSprintByVolgnummer(volgnummer: number): Promise<Sprint | null> {
    const sprint = await this.db.sprints.where('volgnummer').equals(volgnummer).first();
    return sprint ?? null;
  }

  async getAllSprints(): Promise<Sprint[]> {
    return this.db.sprints.orderBy('volgnummer').toArray();
  }

  async updateSprint(id: string, updates: Partial<Sprint>): Promise<void> {
    await this.db.sprints.update(id, updates);
  }

  async deleteSprint(id: string): Promise<boolean> {
    // Cascade delete goals and criteria
    await this.db.transaction('rw', [this.db.sprints, this.db.goals, this.db.criteria], async () => {
      const goalIds = await this.db.goals.where('sprint_id').equals(id).primaryKeys();
      if (goalIds.length > 0) {
        await this.db.criteria.where('goal_id').anyOf(goalIds).delete();
      }
      await this.db.goals.where('sprint_id').equals(id).delete();
      await this.db.sprints.delete(id);
    });
    return true;
  }

  async getMaxVolgnummer(): Promise<number | null> {
    const last = await this.db.sprints.orderBy('volgnummer').reverse().first();
    return last?.volgnummer ?? null;
  }

  async getCurrentSprint(today: string): Promise<Sprint | null> {
    // Range query: startdatum <= today AND einddatum >= today
    const sprint = await this.db.sprints
      .where('startdatum')
      .belowOrEqual(today)
      .filter(s => s.einddatum >= today)
      .reverse()
      .first();
    return sprint ?? null;
  }

  async getLatestSprint(): Promise<Sprint | null> {
    const sprint = await this.db.sprints.orderBy('volgnummer').reverse().first();
    return sprint ?? null;
  }

  // Goal operations
  async createGoal(goal: Goal): Promise<void> {
    await this.db.goals.add(goal);
  }

  async getGoalById(id: string): Promise<Goal | null> {
    const goal = await this.db.goals.get(id);
    return goal ?? null;
  }

  async getGoalsBySprintId(sprintId: string): Promise<Goal[]> {
    return this.db.goals
      .where('sprint_id')
      .equals(sprintId)
      .sortBy('aangemaakt_op');
  }

  async getGoalsByOwner(owner: string): Promise<Goal[]> {
    return this.db.goals
      .where('eigenaar')
      .equals(owner)
      .sortBy('aangemaakt_op');
  }

  async getAllGoals(): Promise<Goal[]> {
    return this.db.goals.orderBy('aangemaakt_op').toArray();
  }

  async updateGoal(id: string, updates: Partial<Goal>): Promise<void> {
    await this.db.goals.update(id, updates);
  }

  async deleteGoal(id: string): Promise<boolean> {
    // Cascade delete criteria
    await this.db.transaction('rw', [this.db.goals, this.db.criteria], async () => {
      await this.db.criteria.where('goal_id').equals(id).delete();
      await this.db.goals.delete(id);
    });
    return true;
  }

  async sprintExists(sprintId: string): Promise<boolean> {
    const count = await this.db.sprints.where('id').equals(sprintId).count();
    return count > 0;
  }

  // Criterion operations
  async createCriterion(criterion: SuccessCriterion): Promise<void> {
    await this.db.criteria.add(criterion);
  }

  async getCriterionById(id: string): Promise<SuccessCriterion | null> {
    const criterion = await this.db.criteria.get(id);
    return criterion ?? null;
  }

  async getCriteriaByGoalId(goalId: string): Promise<SuccessCriterion[]> {
    return this.db.criteria.where('goal_id').equals(goalId).toArray();
  }

  async updateCriterion(id: string, updates: Partial<SuccessCriterion>): Promise<void> {
    await this.db.criteria.update(id, updates);
  }

  async deleteCriterion(id: string): Promise<boolean> {
    await this.db.criteria.delete(id);
    return true;
  }

  async goalExists(goalId: string): Promise<boolean> {
    const count = await this.db.goals.where('id').equals(goalId).count();
    return count > 0;
  }

  // Transaction support
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction('rw', [this.db.sprints, this.db.goals, this.db.criteria], fn);
  }

  /**
   * Clear all data (useful for testing or reset)
   */
  async clearAll(): Promise<void> {
    await this.db.transaction('rw', [this.db.sprints, this.db.goals, this.db.criteria], async () => {
      await this.db.criteria.clear();
      await this.db.goals.clear();
      await this.db.sprints.clear();
    });
  }
}

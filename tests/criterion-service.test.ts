import { SprintService } from '../src/services/sprint-service';
import { GoalService } from '../src/services/goal-service';
import { CriterionService } from '../src/services/criterion-service';
import { createTestDatabase } from '../src/db/database';
import Database from 'better-sqlite3';

describe('CriterionService', () => {
  let db: Database.Database;
  let sprintService: SprintService;
  let goalService: GoalService;
  let criterionService: CriterionService;
  let testGoalId: string;

  beforeEach(() => {
    db = createTestDatabase();
    sprintService = new SprintService(db);
    goalService = new GoalService(db);
    criterionService = new CriterionService(db);

    const sprint = sprintService.create({
      volgnummer: 1,
      startdatum: '2026-01-13',
      einddatum: '2026-01-26',
    });

    const goal = goalService.create({
      sprint_id: sprint.id,
      titel: 'Test Goal',
      beschrijving: 'Test description',
      eigenaar: 'Test Owner',
      geschatte_uren: 8,
    });
    testGoalId = goal.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should create a criterion with valid input', () => {
      const criterion = criterionService.create({
        goal_id: testGoalId,
        beschrijving: 'Test criterion',
      });

      expect(criterion.id).toBeDefined();
      expect(criterion.goal_id).toBe(testGoalId);
      expect(criterion.beschrijving).toBe('Test criterion');
      expect(criterion.voltooid).toBe(false);
    });

    it('should reject non-existent goal_id', () => {
      expect(() => criterionService.create({
        goal_id: '550e8400-e29b-41d4-a716-446655440000',
        beschrijving: 'Test criterion',
      })).toThrow('Goal with ID 550e8400-e29b-41d4-a716-446655440000 not found');
    });
  });

  describe('createMany', () => {
    it('should create multiple criteria at once', () => {
      const criteria = criterionService.createMany(testGoalId, [
        'Criterion 1',
        'Criterion 2',
        'Criterion 3',
      ]);

      expect(criteria).toHaveLength(3);
      expect(criteria[0]?.beschrijving).toBe('Criterion 1');
      expect(criteria[1]?.beschrijving).toBe('Criterion 2');
      expect(criteria[2]?.beschrijving).toBe('Criterion 3');
    });

    it('should reject if any criterion is invalid', () => {
      expect(() => criterionService.createMany(testGoalId, [
        'Valid',
        '', // Invalid - empty
        'Also valid',
      ])).toThrow('Validation failed');
    });
  });

  describe('getByGoalId', () => {
    it('should return all criteria for a goal', () => {
      criterionService.create({ goal_id: testGoalId, beschrijving: 'Criterion 1' });
      criterionService.create({ goal_id: testGoalId, beschrijving: 'Criterion 2' });

      const criteria = criterionService.getByGoalId(testGoalId);
      expect(criteria).toHaveLength(2);
    });

    it('should return empty array for goal with no criteria', () => {
      const criteria = criterionService.getByGoalId(testGoalId);
      expect(criteria).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update criterion beschrijving', () => {
      const created = criterionService.create({
        goal_id: testGoalId,
        beschrijving: 'Original',
      });

      const updated = criterionService.update(created.id, {
        beschrijving: 'Updated',
      });

      expect(updated.beschrijving).toBe('Updated');
    });

    it('should update criterion voltooid', () => {
      const created = criterionService.create({
        goal_id: testGoalId,
        beschrijving: 'Test',
      });

      const updated = criterionService.update(created.id, {
        voltooid: true,
      });

      expect(updated.voltooid).toBe(true);
    });
  });

  describe('toggle', () => {
    it('should toggle incomplete to complete', () => {
      const created = criterionService.create({
        goal_id: testGoalId,
        beschrijving: 'Test',
      });

      expect(created.voltooid).toBe(false);

      const toggled = criterionService.toggle(created.id);
      expect(toggled.voltooid).toBe(true);
    });

    it('should toggle complete to incomplete', () => {
      const created = criterionService.create({
        goal_id: testGoalId,
        beschrijving: 'Test',
      });
      criterionService.complete(created.id);

      const toggled = criterionService.toggle(created.id);
      expect(toggled.voltooid).toBe(false);
    });
  });

  describe('complete', () => {
    it('should mark criterion as complete', () => {
      const created = criterionService.create({
        goal_id: testGoalId,
        beschrijving: 'Test',
      });

      const completed = criterionService.complete(created.id);
      expect(completed.voltooid).toBe(true);
    });
  });

  describe('uncomplete', () => {
    it('should mark criterion as incomplete', () => {
      const created = criterionService.create({
        goal_id: testGoalId,
        beschrijving: 'Test',
      });
      criterionService.complete(created.id);

      const uncompleted = criterionService.uncomplete(created.id);
      expect(uncompleted.voltooid).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete criterion', () => {
      const created = criterionService.create({
        goal_id: testGoalId,
        beschrijving: 'Test',
      });

      const deleted = criterionService.delete(created.id);
      expect(deleted).toBe(true);

      const found = criterionService.getById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('getProgress', () => {
    it('should calculate completion progress', () => {
      criterionService.create({ goal_id: testGoalId, beschrijving: 'Criterion 1' });
      const c2 = criterionService.create({ goal_id: testGoalId, beschrijving: 'Criterion 2' });
      const c3 = criterionService.create({ goal_id: testGoalId, beschrijving: 'Criterion 3' });

      criterionService.complete(c2.id);
      criterionService.complete(c3.id);

      const progress = criterionService.getProgress(testGoalId);
      expect(progress.total).toBe(3);
      expect(progress.completed).toBe(2);
      expect(progress.percentage).toBe(67); // 2/3 = 66.67%, rounded to 67
    });

    it('should return 0% for goal with no criteria', () => {
      const progress = criterionService.getProgress(testGoalId);
      expect(progress.total).toBe(0);
      expect(progress.completed).toBe(0);
      expect(progress.percentage).toBe(0);
    });
  });
});

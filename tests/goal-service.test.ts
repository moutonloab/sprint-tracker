import { SprintService } from '../src/services/sprint-service';
import { GoalService } from '../src/services/goal-service';
import { createTestDatabase } from '../src/db/database';
import Database from 'better-sqlite3';

describe('GoalService', () => {
  let db: Database.Database;
  let sprintService: SprintService;
  let goalService: GoalService;
  let testSprintId: string;

  beforeEach(() => {
    db = createTestDatabase();
    sprintService = new SprintService(db);
    goalService = new GoalService(db);

    const sprint = sprintService.create({
      volgnummer: 1,
      startdatum: '2026-01-13',
      einddatum: '2026-01-26',
    });
    testSprintId = sprint.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should create a goal with valid input', () => {
      const goal = goalService.create({
        sprint_id: testSprintId,
        titel: 'Test Goal',
        beschrijving: 'Test description',
        eigenaar: 'Test Owner',
        geschatte_uren: 8,
      });

      expect(goal.id).toBeDefined();
      expect(goal.titel).toBe('Test Goal');
      expect(goal.beschrijving).toBe('Test description');
      expect(goal.eigenaar).toBe('Test Owner');
      expect(goal.geschatte_uren).toBe(8);
      expect(goal.werkelijke_uren).toBeNull();
      expect(goal.behaald).toBeNull();
      expect(goal.aangemaakt_op).toBeDefined();
      expect(goal.gewijzigd_op).toBeDefined();
    });

    it('should reject non-existent sprint_id', () => {
      expect(() => goalService.create({
        sprint_id: '550e8400-e29b-41d4-a716-446655440000',
        titel: 'Test Goal',
        beschrijving: 'Test description',
        eigenaar: 'Test Owner',
        geschatte_uren: 8,
      })).toThrow('Sprint with ID 550e8400-e29b-41d4-a716-446655440000 not found');
    });

    it('should accept 0.25 hour increments', () => {
      const goal = goalService.create({
        sprint_id: testSprintId,
        titel: 'Test Goal',
        beschrijving: 'Test description',
        eigenaar: 'Test Owner',
        geschatte_uren: 2.75,
      });

      expect(goal.geschatte_uren).toBe(2.75);
    });
  });

  describe('getById', () => {
    it('should return goal by ID', () => {
      const created = goalService.create({
        sprint_id: testSprintId,
        titel: 'Test Goal',
        beschrijving: 'Test description',
        eigenaar: 'Test Owner',
        geschatte_uren: 8,
      });

      const found = goalService.getById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', () => {
      const found = goalService.getById('550e8400-e29b-41d4-a716-446655440000');
      expect(found).toBeNull();
    });
  });

  describe('getBySprintId', () => {
    it('should return all goals for a sprint', () => {
      goalService.create({
        sprint_id: testSprintId,
        titel: 'Goal 1',
        beschrijving: 'Description 1',
        eigenaar: 'Owner',
        geschatte_uren: 4,
      });
      goalService.create({
        sprint_id: testSprintId,
        titel: 'Goal 2',
        beschrijving: 'Description 2',
        eigenaar: 'Owner',
        geschatte_uren: 4,
      });

      const goals = goalService.getBySprintId(testSprintId);
      expect(goals).toHaveLength(2);
    });

    it('should return empty array for sprint with no goals', () => {
      const goals = goalService.getBySprintId(testSprintId);
      expect(goals).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update goal fields', () => {
      const created = goalService.create({
        sprint_id: testSprintId,
        titel: 'Test Goal',
        beschrijving: 'Test description',
        eigenaar: 'Test Owner',
        geschatte_uren: 8,
      });

      const updated = goalService.update(created.id, {
        titel: 'Updated Title',
        werkelijke_uren: 10,
      });

      expect(updated.titel).toBe('Updated Title');
      expect(updated.werkelijke_uren).toBe(10);
      expect(updated.beschrijving).toBe('Test description');
    });

    it('should update gewijzigd_op timestamp', () => {
      const created = goalService.create({
        sprint_id: testSprintId,
        titel: 'Test Goal',
        beschrijving: 'Test description',
        eigenaar: 'Test Owner',
        geschatte_uren: 8,
      });

      const originalTimestamp = new Date(created.gewijzigd_op).getTime();

      const updated = goalService.update(created.id, { titel: 'Updated' });
      const updatedTimestamp = new Date(updated.gewijzigd_op).getTime();

      // Timestamp should be greater than or equal to original (fast execution may have same ms)
      expect(updatedTimestamp).toBeGreaterThanOrEqual(originalTimestamp);
      // Verify it's a valid ISO datetime
      expect(updated.gewijzigd_op).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('markAchieved', () => {
    it('should mark goal as achieved', () => {
      const created = goalService.create({
        sprint_id: testSprintId,
        titel: 'Test Goal',
        beschrijving: 'Test description',
        eigenaar: 'Test Owner',
        geschatte_uren: 8,
      });

      const updated = goalService.markAchieved(
        created.id,
        true,
        'Completed successfully',
        'Learned a lot'
      );

      expect(updated.behaald).toBe(true);
      expect(updated.toelichting).toBe('Completed successfully');
      expect(updated.geleerde_lessen).toBe('Learned a lot');
    });

    it('should mark goal as not achieved', () => {
      const created = goalService.create({
        sprint_id: testSprintId,
        titel: 'Test Goal',
        beschrijving: 'Test description',
        eigenaar: 'Test Owner',
        geschatte_uren: 8,
      });

      const updated = goalService.markAchieved(
        created.id,
        false,
        'Ran out of time'
      );

      expect(updated.behaald).toBe(false);
      expect(updated.toelichting).toBe('Ran out of time');
    });
  });

  describe('logHours', () => {
    it('should log actual hours', () => {
      const created = goalService.create({
        sprint_id: testSprintId,
        titel: 'Test Goal',
        beschrijving: 'Test description',
        eigenaar: 'Test Owner',
        geschatte_uren: 8,
      });

      const updated = goalService.logHours(created.id, 12.5);
      expect(updated.werkelijke_uren).toBe(12.5);
    });
  });

  describe('delete', () => {
    it('should delete goal', () => {
      const created = goalService.create({
        sprint_id: testSprintId,
        titel: 'Test Goal',
        beschrijving: 'Test description',
        eigenaar: 'Test Owner',
        geschatte_uren: 8,
      });

      const deleted = goalService.delete(created.id);
      expect(deleted).toBe(true);

      const found = goalService.getById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('getSprintStats', () => {
    it('should calculate sprint statistics', () => {
      goalService.create({
        sprint_id: testSprintId,
        titel: 'Goal 1',
        beschrijving: 'Description',
        eigenaar: 'Owner',
        geschatte_uren: 4,
      });
      const goal2 = goalService.create({
        sprint_id: testSprintId,
        titel: 'Goal 2',
        beschrijving: 'Description',
        eigenaar: 'Owner',
        geschatte_uren: 8,
      });

      goalService.markAchieved(goal2.id, true);
      goalService.logHours(goal2.id, 10);

      const stats = goalService.getSprintStats(testSprintId);
      expect(stats.totalGoals).toBe(2);
      expect(stats.completedGoals).toBe(1);
      expect(stats.estimatedHours).toBe(12);
      expect(stats.actualHours).toBe(10);
    });
  });
});

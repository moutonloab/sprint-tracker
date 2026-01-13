import { SprintService } from '../src/services/sprint-service';
import { GoalService } from '../src/services/goal-service';
import { CriterionService } from '../src/services/criterion-service';
import { ExportService } from '../src/services/export-service';
import { createTestDatabase } from '../src/db/database';
import { ExportData } from '../src/types';
import Database from 'better-sqlite3';

describe('ExportService', () => {
  let db: Database.Database;
  let sprintService: SprintService;
  let goalService: GoalService;
  let criterionService: CriterionService;
  let exportService: ExportService;

  beforeEach(() => {
    db = createTestDatabase();
    sprintService = new SprintService(db);
    goalService = new GoalService(db);
    criterionService = new CriterionService(db);
    exportService = new ExportService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('exportAll', () => {
    it('should export all data', () => {
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

      criterionService.create({
        goal_id: goal.id,
        beschrijving: 'Criterion 1',
      });
      criterionService.create({
        goal_id: goal.id,
        beschrijving: 'Criterion 2',
      });

      const exported = exportService.exportAll();

      expect(exported.version).toBe('1.0');
      expect(exported.exported_at).toBeDefined();
      expect(exported.sprints).toHaveLength(1);
      expect(exported.sprints[0]?.goals).toHaveLength(1);
      expect(exported.sprints[0]?.goals[0]?.success_criteria).toHaveLength(2);
    });

    it('should export empty data', () => {
      const exported = exportService.exportAll();

      expect(exported.version).toBe('1.0');
      expect(exported.sprints).toHaveLength(0);
    });
  });

  describe('exportSprint', () => {
    it('should export a single sprint with goals and criteria', () => {
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

      criterionService.create({
        goal_id: goal.id,
        beschrijving: 'Criterion 1',
      });

      const exported = exportService.exportSprint(sprint.id);

      expect(exported).not.toBeNull();
      expect(exported?.id).toBe(sprint.id);
      expect(exported?.goals).toHaveLength(1);
      expect(exported?.goals[0]?.success_criteria).toHaveLength(1);
    });

    it('should return null for non-existent sprint', () => {
      const exported = exportService.exportSprint('550e8400-e29b-41d4-a716-446655440000');
      expect(exported).toBeNull();
    });
  });

  describe('importData', () => {
    it('should import valid data', () => {
      const importData: ExportData = {
        version: '1.0',
        exported_at: '2026-01-13T09:00:00Z',
        sprints: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            volgnummer: 1,
            startdatum: '2026-01-13',
            einddatum: '2026-01-26',
            goals: [
              {
                id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                sprint_id: '550e8400-e29b-41d4-a716-446655440000',
                titel: 'Test Goal',
                beschrijving: 'Test description',
                eigenaar: 'Test Owner',
                geschatte_uren: 8,
                werkelijke_uren: null,
                behaald: null,
                toelichting: null,
                geleerde_lessen: null,
                aangemaakt_op: '2026-01-13T09:00:00Z',
                gewijzigd_op: '2026-01-13T09:00:00Z',
                success_criteria: [
                  {
                    id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
                    goal_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                    beschrijving: 'Test criterion',
                    voltooid: false,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = exportService.importData(importData);

      expect(result.sprints).toBe(1);
      expect(result.goals).toBe(1);
      expect(result.criteria).toBe(1);
      expect(result.errors).toHaveLength(0);

      const sprint = sprintService.getById('550e8400-e29b-41d4-a716-446655440000');
      expect(sprint).not.toBeNull();

      const goals = goalService.getBySprintId(sprint!.id);
      expect(goals).toHaveLength(1);

      const criteria = criterionService.getByGoalId(goals[0]!.id);
      expect(criteria).toHaveLength(1);
    });

    it('should skip existing sprints without overwrite', () => {
      const sprint = sprintService.create({
        volgnummer: 1,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      });

      const importData: ExportData = {
        version: '1.0',
        exported_at: '2026-01-13T09:00:00Z',
        sprints: [
          {
            id: sprint.id,
            volgnummer: 1,
            startdatum: '2026-01-13',
            einddatum: '2026-01-26',
            goals: [],
          },
        ],
      };

      const result = exportService.importData(importData);

      expect(result.sprints).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should overwrite existing sprints with overwrite option', () => {
      const sprint = sprintService.create({
        volgnummer: 1,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      });

      const importData: ExportData = {
        version: '1.0',
        exported_at: '2026-01-13T09:00:00Z',
        sprints: [
          {
            id: sprint.id,
            volgnummer: 1,
            startdatum: '2026-01-13',
            einddatum: '2026-01-27', // Different end date
            goals: [],
          },
        ],
      };

      const result = exportService.importData(importData, { overwrite: true });

      expect(result.sprints).toBe(1);
      expect(result.skipped).toBe(0);

      const updated = sprintService.getById(sprint.id);
      expect(updated?.einddatum).toBe('2026-01-27');
    });

    it('should reject invalid data', () => {
      const importData = {
        version: '1.0',
        exported_at: '2026-01-13T09:00:00Z',
        sprints: [
          {
            id: 'invalid-uuid',
            volgnummer: 1,
            startdatum: '2026-01-13',
            einddatum: '2026-01-26',
            goals: [],
          },
        ],
      } as ExportData;

      const result = exportService.importData(importData);

      expect(result.sprints).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('round-trip export/import', () => {
    it('should preserve all data through export/import cycle', () => {
      // Create test data
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
        geschatte_uren: 8.5,
      });

      goalService.markAchieved(goal.id, true, 'Completed', 'Learned something');
      goalService.logHours(goal.id, 10.25);

      criterionService.create({ goal_id: goal.id, beschrijving: 'Criterion 1' });
      const c2 = criterionService.create({ goal_id: goal.id, beschrijving: 'Criterion 2' });
      criterionService.complete(c2.id);

      // Export
      const exported = exportService.exportAll();

      // Clear database
      db.exec('DELETE FROM success_criterion');
      db.exec('DELETE FROM goal');
      db.exec('DELETE FROM sprint');

      // Verify data is gone
      expect(sprintService.getAll()).toHaveLength(0);

      // Import
      const result = exportService.importData(exported);
      expect(result.errors).toHaveLength(0);

      // Verify data is restored
      const restoredSprint = sprintService.getById(sprint.id);
      expect(restoredSprint).not.toBeNull();
      expect(restoredSprint?.volgnummer).toBe(1);

      const restoredGoals = goalService.getBySprintId(sprint.id);
      expect(restoredGoals).toHaveLength(1);
      expect(restoredGoals[0]?.behaald).toBe(true);
      expect(restoredGoals[0]?.werkelijke_uren).toBe(10.25);

      const restoredCriteria = criterionService.getByGoalId(goal.id);
      expect(restoredCriteria).toHaveLength(2);
      expect(restoredCriteria.filter(c => c.voltooid)).toHaveLength(1);
    });
  });
});

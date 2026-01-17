import {
  ExportData,
  SprintWithGoals,
  GoalWithCriteria,
  ImportResult,
} from '../types';
import { SprintService } from './sprint-service';
import { GoalService } from './goal-service';
import { CriterionService } from './criterion-service';
import { StorageAdapter } from '../interfaces/storage';
import { isValidUUID, isValidDate, isValidDateTime, isValidHoursPrecision } from '../validation';

export const EXPORT_VERSION = '1.0';

export class ExportService {
  private sprintService: SprintService;
  private goalService: GoalService;
  private criterionService: CriterionService;

  constructor(private storage: StorageAdapter) {
    this.sprintService = new SprintService(storage);
    this.goalService = new GoalService(storage);
    this.criterionService = new CriterionService(storage);
  }

  /**
   * Export all data to a JSON structure
   */
  async exportAll(): Promise<ExportData> {
    const sprints = await this.sprintService.getAll();

    const sprintsWithGoals: SprintWithGoals[] = await Promise.all(
      sprints.map(async sprint => {
        const goals = await this.goalService.getBySprintId(sprint.id);
        const goalsWithCriteria: GoalWithCriteria[] = await Promise.all(
          goals.map(async goal => ({
            ...goal,
            success_criteria: await this.criterionService.getByGoalId(goal.id),
          }))
        );

        return {
          ...sprint,
          goals: goalsWithCriteria,
        };
      })
    );

    return {
      version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      sprints: sprintsWithGoals,
    };
  }

  /**
   * Export a single sprint with its goals and criteria
   */
  async exportSprint(sprintId: string): Promise<SprintWithGoals | null> {
    const sprint = await this.sprintService.getById(sprintId);
    if (sprint === null) {
      return null;
    }

    const goals = await this.goalService.getBySprintId(sprint.id);
    const goalsWithCriteria: GoalWithCriteria[] = await Promise.all(
      goals.map(async goal => ({
        ...goal,
        success_criteria: await this.criterionService.getByGoalId(goal.id),
      }))
    );

    return {
      ...sprint,
      goals: goalsWithCriteria,
    };
  }

  /**
   * Import data from JSON structure
   */
  async importData(data: ExportData, options: { overwrite?: boolean } = {}): Promise<ImportResult> {
    const stats: ImportResult = { sprints: 0, goals: 0, criteria: 0, skipped: 0, errors: [] };

    const validationResult = this.validateImportData(data);
    if (!validationResult.valid) {
      stats.errors = validationResult.errors;
      return stats;
    }

    try {
      await this.storage.transaction(async () => {
        for (const sprintData of data.sprints) {
          const existingSprint = await this.sprintService.getById(sprintData.id);

          if (existingSprint !== null) {
            if (options.overwrite === true) {
              await this.sprintService.delete(sprintData.id);
            } else {
              stats.skipped++;
              stats.errors.push(`Sprint ${sprintData.volgnummer} already exists (ID: ${sprintData.id})`);
              continue;
            }
          }

          await this.storage.createSprint({
            id: sprintData.id,
            volgnummer: sprintData.volgnummer,
            startdatum: sprintData.startdatum,
            einddatum: sprintData.einddatum,
          });
          stats.sprints++;

          for (const goalData of sprintData.goals) {
            await this.storage.createGoal({
              id: goalData.id,
              sprint_id: goalData.sprint_id,
              titel: goalData.titel,
              beschrijving: goalData.beschrijving,
              eigenaar: goalData.eigenaar,
              geschatte_uren: goalData.geschatte_uren,
              werkelijke_uren: goalData.werkelijke_uren,
              behaald: goalData.behaald,
              toelichting: goalData.toelichting,
              geleerde_lessen: goalData.geleerde_lessen,
              aangemaakt_op: goalData.aangemaakt_op,
              gewijzigd_op: goalData.gewijzigd_op,
            });
            stats.goals++;

            for (const criterionData of goalData.success_criteria) {
              await this.storage.createCriterion({
                id: criterionData.id,
                goal_id: criterionData.goal_id,
                beschrijving: criterionData.beschrijving,
                voltooid: criterionData.voltooid,
              });
              stats.criteria++;
            }
          }
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stats.errors.push(`Import failed: ${message}`);
    }

    return stats;
  }

  /**
   * Validate import data structure
   */
  validateImportData(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return { valid: false, errors: ['Data must be an object'] };
    }

    const exportData = data as Record<string, unknown>;

    if (typeof exportData['version'] !== 'string') {
      errors.push('Missing or invalid version field');
    }

    if (!Array.isArray(exportData['sprints'])) {
      errors.push('Missing or invalid sprints array');
      return { valid: false, errors };
    }

    const sprints = exportData['sprints'] as unknown[];
    for (let i = 0; i < sprints.length; i++) {
      const sprintErrors = this.validateSprintData(sprints[i], i);
      errors.push(...sprintErrors);
    }

    return { valid: errors.length === 0, errors };
  }

  private validateSprintData(data: unknown, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Sprint[${index}]`;

    if (typeof data !== 'object' || data === null) {
      return [`${prefix}: must be an object`];
    }

    const sprint = data as Record<string, unknown>;

    if (typeof sprint['id'] !== 'string' || !isValidUUID(sprint['id'])) {
      errors.push(`${prefix}.id: must be a valid UUID`);
    }

    if (typeof sprint['volgnummer'] !== 'number' || sprint['volgnummer'] < 1) {
      errors.push(`${prefix}.volgnummer: must be a positive integer`);
    }

    if (typeof sprint['startdatum'] !== 'string' || !isValidDate(sprint['startdatum'])) {
      errors.push(`${prefix}.startdatum: must be a valid date (YYYY-MM-DD)`);
    }

    if (typeof sprint['einddatum'] !== 'string' || !isValidDate(sprint['einddatum'])) {
      errors.push(`${prefix}.einddatum: must be a valid date (YYYY-MM-DD)`);
    }

    if (Array.isArray(sprint['goals'])) {
      const goals = sprint['goals'] as unknown[];
      for (let i = 0; i < goals.length; i++) {
        const goalErrors = this.validateGoalData(goals[i], `${prefix}.goals[${i}]`);
        errors.push(...goalErrors);
      }
    }

    return errors;
  }

  private validateGoalData(data: unknown, prefix: string): string[] {
    const errors: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return [`${prefix}: must be an object`];
    }

    const goal = data as Record<string, unknown>;

    if (typeof goal['id'] !== 'string' || !isValidUUID(goal['id'])) {
      errors.push(`${prefix}.id: must be a valid UUID`);
    }

    if (typeof goal['sprint_id'] !== 'string' || !isValidUUID(goal['sprint_id'])) {
      errors.push(`${prefix}.sprint_id: must be a valid UUID`);
    }

    if (typeof goal['titel'] !== 'string' || goal['titel'].length === 0 || goal['titel'].length > 200) {
      errors.push(`${prefix}.titel: must be a string (1-200 chars)`);
    }

    if (typeof goal['beschrijving'] !== 'string' || goal['beschrijving'].length > 2000) {
      errors.push(`${prefix}.beschrijving: must be a string (max 2000 chars)`);
    }

    if (typeof goal['eigenaar'] !== 'string' || goal['eigenaar'].length === 0 || goal['eigenaar'].length > 50) {
      errors.push(`${prefix}.eigenaar: must be a string (1-50 chars)`);
    }

    if (typeof goal['geschatte_uren'] !== 'number' || goal['geschatte_uren'] < 0) {
      errors.push(`${prefix}.geschatte_uren: must be a non-negative number`);
    } else if (!isValidHoursPrecision(goal['geschatte_uren'] as number)) {
      errors.push(`${prefix}.geschatte_uren: must be in 0.25 hour increments`);
    }

    if (goal['werkelijke_uren'] !== null && goal['werkelijke_uren'] !== undefined) {
      if (typeof goal['werkelijke_uren'] !== 'number' || goal['werkelijke_uren'] < 0) {
        errors.push(`${prefix}.werkelijke_uren: must be a non-negative number or null`);
      } else if (!isValidHoursPrecision(goal['werkelijke_uren'] as number)) {
        errors.push(`${prefix}.werkelijke_uren: must be in 0.25 hour increments`);
      }
    }

    if (typeof goal['aangemaakt_op'] !== 'string' || !isValidDateTime(goal['aangemaakt_op'])) {
      errors.push(`${prefix}.aangemaakt_op: must be a valid ISO datetime`);
    }

    if (typeof goal['gewijzigd_op'] !== 'string' || !isValidDateTime(goal['gewijzigd_op'])) {
      errors.push(`${prefix}.gewijzigd_op: must be a valid ISO datetime`);
    }

    if (Array.isArray(goal['success_criteria'])) {
      const criteria = goal['success_criteria'] as unknown[];
      for (let i = 0; i < criteria.length; i++) {
        const criterionErrors = this.validateCriterionData(criteria[i], `${prefix}.success_criteria[${i}]`);
        errors.push(...criterionErrors);
      }
    }

    return errors;
  }

  private validateCriterionData(data: unknown, prefix: string): string[] {
    const errors: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return [`${prefix}: must be an object`];
    }

    const criterion = data as Record<string, unknown>;

    if (typeof criterion['id'] !== 'string' || !isValidUUID(criterion['id'])) {
      errors.push(`${prefix}.id: must be a valid UUID`);
    }

    if (typeof criterion['goal_id'] !== 'string' || !isValidUUID(criterion['goal_id'])) {
      errors.push(`${prefix}.goal_id: must be a valid UUID`);
    }

    if (typeof criterion['beschrijving'] !== 'string' || criterion['beschrijving'].length === 0 || criterion['beschrijving'].length > 500) {
      errors.push(`${prefix}.beschrijving: must be a string (1-500 chars)`);
    }

    if (typeof criterion['voltooid'] !== 'boolean') {
      errors.push(`${prefix}.voltooid: must be a boolean`);
    }

    return errors;
  }
}

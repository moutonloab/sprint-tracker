import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  ExportData,
  SprintWithGoals,
  GoalWithCriteria,
  Sprint,
  Goal,
  SuccessCriterion,
} from '../types';
import { SprintService } from './sprint-service';
import { GoalService } from './goal-service';
import { CriterionService } from './criterion-service';
import { getDatabase } from '../db/database';
import { isValidUUID, isValidDate, isValidDateTime, isValidHoursPrecision } from '../validation';

const EXPORT_VERSION = '1.0';

export class ExportService {
  private db: Database.Database;
  private sprintService: SprintService;
  private goalService: GoalService;
  private criterionService: CriterionService;

  constructor(database?: Database.Database) {
    this.db = database ?? getDatabase();
    this.sprintService = new SprintService(this.db);
    this.goalService = new GoalService(this.db);
    this.criterionService = new CriterionService(this.db);
  }

  /**
   * Export all data to a JSON structure
   */
  exportAll(): ExportData {
    const sprints = this.sprintService.getAll();

    const sprintsWithGoals: SprintWithGoals[] = sprints.map(sprint => {
      const goals = this.goalService.getBySprintId(sprint.id);
      const goalsWithCriteria: GoalWithCriteria[] = goals.map(goal => ({
        ...goal,
        success_criteria: this.criterionService.getByGoalId(goal.id),
      }));

      return {
        ...sprint,
        goals: goalsWithCriteria,
      };
    });

    return {
      version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      sprints: sprintsWithGoals,
    };
  }

  /**
   * Export a single sprint with its goals and criteria
   */
  exportSprint(sprintId: string): SprintWithGoals | null {
    const sprint = this.sprintService.getById(sprintId);
    if (sprint === null) {
      return null;
    }

    const goals = this.goalService.getBySprintId(sprint.id);
    const goalsWithCriteria: GoalWithCriteria[] = goals.map(goal => ({
      ...goal,
      success_criteria: this.criterionService.getByGoalId(goal.id),
    }));

    return {
      ...sprint,
      goals: goalsWithCriteria,
    };
  }

  /**
   * Export data to a JSON file
   */
  exportToFile(filePath: string, sprintId?: string): void {
    const data = sprintId !== undefined
      ? { version: EXPORT_VERSION, exported_at: new Date().toISOString(), sprints: [this.exportSprint(sprintId)].filter(Boolean) as SprintWithGoals[] }
      : this.exportAll();

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Import data from JSON structure
   */
  importData(data: ExportData, options: { overwrite?: boolean } = {}): {
    sprints: number;
    goals: number;
    criteria: number;
    skipped: number;
    errors: string[];
  } {
    const stats = { sprints: 0, goals: 0, criteria: 0, skipped: 0, errors: [] as string[] };

    const validationResult = this.validateImportData(data);
    if (!validationResult.valid) {
      stats.errors = validationResult.errors;
      return stats;
    }

    const importTransaction = this.db.transaction(() => {
      for (const sprintData of data.sprints) {
        const existingSprint = this.sprintService.getById(sprintData.id);

        if (existingSprint !== null) {
          if (options.overwrite === true) {
            this.sprintService.delete(sprintData.id);
          } else {
            stats.skipped++;
            stats.errors.push(`Sprint ${sprintData.volgnummer} already exists (ID: ${sprintData.id})`);
            continue;
          }
        }

        this.importSprint(sprintData);
        stats.sprints++;

        for (const goalData of sprintData.goals) {
          this.importGoal(goalData);
          stats.goals++;

          for (const criterionData of goalData.success_criteria) {
            this.importCriterion(criterionData);
            stats.criteria++;
          }
        }
      }
    });

    try {
      importTransaction();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stats.errors.push(`Import failed: ${message}`);
    }

    return stats;
  }

  /**
   * Import data from a JSON file
   */
  importFromFile(filePath: string, options: { overwrite?: boolean } = {}): ReturnType<typeof this.importData> {
    if (!fs.existsSync(filePath)) {
      return { sprints: 0, goals: 0, criteria: 0, skipped: 0, errors: [`File not found: ${filePath}`] };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as ExportData;
      return this.importData(data, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { sprints: 0, goals: 0, criteria: 0, skipped: 0, errors: [`Failed to parse file: ${message}`] };
    }
  }

  /**
   * Validate import data structure
   */
  private validateImportData(data: unknown): { valid: boolean; errors: string[] } {
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

  private importSprint(data: SprintWithGoals): void {
    this.db.prepare(`
      INSERT INTO sprint (id, volgnummer, startdatum, einddatum)
      VALUES (@id, @volgnummer, @startdatum, @einddatum)
    `).run({
      id: data.id,
      volgnummer: data.volgnummer,
      startdatum: data.startdatum,
      einddatum: data.einddatum,
    });
  }

  private importGoal(data: GoalWithCriteria): void {
    this.db.prepare(`
      INSERT INTO goal (
        id, sprint_id, titel, beschrijving, eigenaar, geschatte_uren,
        werkelijke_uren, behaald, toelichting, geleerde_lessen,
        aangemaakt_op, gewijzigd_op
      ) VALUES (
        @id, @sprint_id, @titel, @beschrijving, @eigenaar, @geschatte_uren,
        @werkelijke_uren, @behaald, @toelichting, @geleerde_lessen,
        @aangemaakt_op, @gewijzigd_op
      )
    `).run({
      id: data.id,
      sprint_id: data.sprint_id,
      titel: data.titel,
      beschrijving: data.beschrijving,
      eigenaar: data.eigenaar,
      geschatte_uren: data.geschatte_uren,
      werkelijke_uren: data.werkelijke_uren,
      behaald: data.behaald === null ? null : (data.behaald ? 1 : 0),
      toelichting: data.toelichting,
      geleerde_lessen: data.geleerde_lessen,
      aangemaakt_op: data.aangemaakt_op,
      gewijzigd_op: data.gewijzigd_op,
    });
  }

  private importCriterion(data: SuccessCriterion): void {
    this.db.prepare(`
      INSERT INTO success_criterion (id, goal_id, beschrijving, voltooid)
      VALUES (@id, @goal_id, @beschrijving, @voltooid)
    `).run({
      id: data.id,
      goal_id: data.goal_id,
      beschrijving: data.beschrijving,
      voltooid: data.voltooid ? 1 : 0,
    });
  }
}

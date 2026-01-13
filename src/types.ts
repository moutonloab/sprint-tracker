/**
 * Sprint Tracking Data Model Types
 * Based on the Sprint Tracking Data Model v1.0
 */

/**
 * Sprint entity - Container for a 2-week work cycle
 */
export interface Sprint {
  id: string;
  volgnummer: number;
  startdatum: string;
  einddatum: string;
}

/**
 * Goal entity - An objective to be achieved within a sprint
 */
export interface Goal {
  id: string;
  sprint_id: string;
  titel: string;
  beschrijving: string;
  eigenaar: string;
  geschatte_uren: number;
  werkelijke_uren: number | null;
  behaald: boolean | null;
  toelichting: string | null;
  geleerde_lessen: string | null;
  aangemaakt_op: string;
  gewijzigd_op: string;
}

/**
 * Success Criterion entity - Checklist item defining goal success
 */
export interface SuccessCriterion {
  id: string;
  goal_id: string;
  beschrijving: string;
  voltooid: boolean;
}

/**
 * Input types for creating entities (without auto-generated fields)
 */
export interface CreateSprintInput {
  volgnummer: number;
  startdatum: string;
  einddatum: string;
}

export interface UpdateSprintInput {
  volgnummer?: number;
  startdatum?: string;
  einddatum?: string;
}

export interface CreateGoalInput {
  sprint_id: string;
  titel: string;
  beschrijving: string;
  eigenaar: string;
  geschatte_uren: number;
}

export interface UpdateGoalInput {
  titel?: string;
  beschrijving?: string;
  eigenaar?: string;
  geschatte_uren?: number;
  werkelijke_uren?: number | null;
  behaald?: boolean | null;
  toelichting?: string | null;
  geleerde_lessen?: string | null;
}

export interface CreateSuccessCriterionInput {
  goal_id: string;
  beschrijving: string;
}

export interface UpdateSuccessCriterionInput {
  beschrijving?: string;
  voltooid?: boolean;
}

/**
 * Aggregated types for export/import
 */
export interface GoalWithCriteria extends Goal {
  success_criteria: SuccessCriterion[];
}

export interface SprintWithGoals extends Sprint {
  goals: GoalWithCriteria[];
}

export interface ExportData {
  version: string;
  exported_at: string;
  sprints: SprintWithGoals[];
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

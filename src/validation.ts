import {
  CreateSprintInput,
  UpdateSprintInput,
  CreateGoalInput,
  UpdateGoalInput,
  CreateSuccessCriterionInput,
  UpdateSuccessCriterionInput,
  ValidationResult,
} from './types';

/**
 * Validate UUID format (RFC 4122)
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate ISO 8601 date format (YYYY-MM-DD)
 */
export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const parsed = new Date(date);
  return !isNaN(parsed.getTime()) && date === parsed.toISOString().split('T')[0];
}

/**
 * Validate ISO 8601 datetime format
 */
export function isValidDateTime(datetime: string): boolean {
  const parsed = new Date(datetime);
  return !isNaN(parsed.getTime());
}

/**
 * Validate hours precision (0.25 hour increments)
 */
export function isValidHoursPrecision(hours: number): boolean {
  return hours >= 0 && (hours * 4) % 1 === 0;
}

/**
 * Validate sprint input
 */
export function validateCreateSprint(input: CreateSprintInput): ValidationResult {
  const errors: string[] = [];

  if (typeof input.volgnummer !== 'number' || input.volgnummer < 1 || !Number.isInteger(input.volgnummer)) {
    errors.push('volgnummer must be a positive integer');
  }

  if (!isValidDate(input.startdatum)) {
    errors.push('startdatum must be a valid date in YYYY-MM-DD format');
  }

  if (!isValidDate(input.einddatum)) {
    errors.push('einddatum must be a valid date in YYYY-MM-DD format');
  }

  if (isValidDate(input.startdatum) && isValidDate(input.einddatum)) {
    if (input.einddatum <= input.startdatum) {
      errors.push('einddatum must be after startdatum');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate sprint update input
 */
export function validateUpdateSprint(input: UpdateSprintInput): ValidationResult {
  const errors: string[] = [];

  if (input.volgnummer !== undefined) {
    if (typeof input.volgnummer !== 'number' || input.volgnummer < 1 || !Number.isInteger(input.volgnummer)) {
      errors.push('volgnummer must be a positive integer');
    }
  }

  if (input.startdatum !== undefined && !isValidDate(input.startdatum)) {
    errors.push('startdatum must be a valid date in YYYY-MM-DD format');
  }

  if (input.einddatum !== undefined && !isValidDate(input.einddatum)) {
    errors.push('einddatum must be a valid date in YYYY-MM-DD format');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate goal input
 */
export function validateCreateGoal(input: CreateGoalInput): ValidationResult {
  const errors: string[] = [];

  if (!isValidUUID(input.sprint_id)) {
    errors.push('sprint_id must be a valid UUID');
  }

  if (typeof input.titel !== 'string' || input.titel.length === 0) {
    errors.push('titel is required');
  } else if (input.titel.length > 200) {
    errors.push('titel must not exceed 200 characters');
  }

  if (typeof input.beschrijving !== 'string') {
    errors.push('beschrijving is required');
  } else if (input.beschrijving.length > 2000) {
    errors.push('beschrijving must not exceed 2000 characters');
  }

  if (typeof input.eigenaar !== 'string' || input.eigenaar.length === 0) {
    errors.push('eigenaar is required');
  } else if (input.eigenaar.length > 50) {
    errors.push('eigenaar must not exceed 50 characters');
  }

  if (typeof input.geschatte_uren !== 'number' || input.geschatte_uren < 0) {
    errors.push('geschatte_uren must be a non-negative number');
  } else if (!isValidHoursPrecision(input.geschatte_uren)) {
    errors.push('geschatte_uren must be in 0.25 hour increments');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate goal update input
 */
export function validateUpdateGoal(input: UpdateGoalInput): ValidationResult {
  const errors: string[] = [];

  if (input.titel !== undefined) {
    if (typeof input.titel !== 'string' || input.titel.length === 0) {
      errors.push('titel cannot be empty');
    } else if (input.titel.length > 200) {
      errors.push('titel must not exceed 200 characters');
    }
  }

  if (input.beschrijving !== undefined) {
    if (typeof input.beschrijving !== 'string') {
      errors.push('beschrijving must be a string');
    } else if (input.beschrijving.length > 2000) {
      errors.push('beschrijving must not exceed 2000 characters');
    }
  }

  if (input.eigenaar !== undefined) {
    if (typeof input.eigenaar !== 'string' || input.eigenaar.length === 0) {
      errors.push('eigenaar cannot be empty');
    } else if (input.eigenaar.length > 50) {
      errors.push('eigenaar must not exceed 50 characters');
    }
  }

  if (input.geschatte_uren !== undefined) {
    if (typeof input.geschatte_uren !== 'number' || input.geschatte_uren < 0) {
      errors.push('geschatte_uren must be a non-negative number');
    } else if (!isValidHoursPrecision(input.geschatte_uren)) {
      errors.push('geschatte_uren must be in 0.25 hour increments');
    }
  }

  if (input.werkelijke_uren !== undefined && input.werkelijke_uren !== null) {
    if (typeof input.werkelijke_uren !== 'number' || input.werkelijke_uren < 0) {
      errors.push('werkelijke_uren must be a non-negative number or null');
    } else if (!isValidHoursPrecision(input.werkelijke_uren)) {
      errors.push('werkelijke_uren must be in 0.25 hour increments');
    }
  }

  if (input.toelichting !== undefined && input.toelichting !== null) {
    if (typeof input.toelichting !== 'string') {
      errors.push('toelichting must be a string or null');
    } else if (input.toelichting.length > 2000) {
      errors.push('toelichting must not exceed 2000 characters');
    }
  }

  if (input.geleerde_lessen !== undefined && input.geleerde_lessen !== null) {
    if (typeof input.geleerde_lessen !== 'string') {
      errors.push('geleerde_lessen must be a string or null');
    } else if (input.geleerde_lessen.length > 2000) {
      errors.push('geleerde_lessen must not exceed 2000 characters');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate success criterion input
 */
export function validateCreateSuccessCriterion(input: CreateSuccessCriterionInput): ValidationResult {
  const errors: string[] = [];

  if (!isValidUUID(input.goal_id)) {
    errors.push('goal_id must be a valid UUID');
  }

  if (typeof input.beschrijving !== 'string' || input.beschrijving.length === 0) {
    errors.push('beschrijving is required');
  } else if (input.beschrijving.length > 500) {
    errors.push('beschrijving must not exceed 500 characters');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate success criterion update input
 */
export function validateUpdateSuccessCriterion(input: UpdateSuccessCriterionInput): ValidationResult {
  const errors: string[] = [];

  if (input.beschrijving !== undefined) {
    if (typeof input.beschrijving !== 'string' || input.beschrijving.length === 0) {
      errors.push('beschrijving cannot be empty');
    } else if (input.beschrijving.length > 500) {
      errors.push('beschrijving must not exceed 500 characters');
    }
  }

  if (input.voltooid !== undefined && typeof input.voltooid !== 'boolean') {
    errors.push('voltooid must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

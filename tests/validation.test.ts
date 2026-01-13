import {
  isValidUUID,
  isValidDate,
  isValidDateTime,
  isValidHoursPrecision,
  validateCreateSprint,
  validateUpdateSprint,
  validateCreateGoal,
  validateUpdateGoal,
  validateCreateSuccessCriterion,
  validateUpdateSuccessCriterion,
} from '../src/validation';

describe('Validation utilities', () => {
  describe('isValidUUID', () => {
    it('should accept valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // too short
      expect(isValidUUID('550e8400-e29b-61d4-a716-446655440000')).toBe(false); // invalid version
    });
  });

  describe('isValidDate', () => {
    it('should accept valid dates', () => {
      expect(isValidDate('2026-01-13')).toBe(true);
      expect(isValidDate('2026-12-31')).toBe(true);
    });

    it('should reject invalid dates', () => {
      expect(isValidDate('')).toBe(false);
      expect(isValidDate('2026/01/13')).toBe(false);
      expect(isValidDate('01-13-2026')).toBe(false);
      expect(isValidDate('2026-13-01')).toBe(false); // invalid month
      expect(isValidDate('2026-02-30')).toBe(false); // invalid day
    });
  });

  describe('isValidDateTime', () => {
    it('should accept valid datetimes', () => {
      expect(isValidDateTime('2026-01-13T09:00:00Z')).toBe(true);
      expect(isValidDateTime('2026-01-13T09:00:00.000Z')).toBe(true);
    });

    it('should reject invalid datetimes', () => {
      expect(isValidDateTime('')).toBe(false);
      expect(isValidDateTime('not-a-datetime')).toBe(false);
    });
  });

  describe('isValidHoursPrecision', () => {
    it('should accept valid hours', () => {
      expect(isValidHoursPrecision(0)).toBe(true);
      expect(isValidHoursPrecision(0.25)).toBe(true);
      expect(isValidHoursPrecision(0.5)).toBe(true);
      expect(isValidHoursPrecision(0.75)).toBe(true);
      expect(isValidHoursPrecision(1)).toBe(true);
      expect(isValidHoursPrecision(8.25)).toBe(true);
    });

    it('should reject invalid hours', () => {
      expect(isValidHoursPrecision(-1)).toBe(false);
      expect(isValidHoursPrecision(0.1)).toBe(false);
      expect(isValidHoursPrecision(0.33)).toBe(false);
    });
  });
});

describe('Sprint validation', () => {
  describe('validateCreateSprint', () => {
    it('should accept valid input', () => {
      const result = validateCreateSprint({
        volgnummer: 1,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid volgnummer', () => {
      const result = validateCreateSprint({
        volgnummer: 0,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('volgnummer must be a positive integer');
    });

    it('should reject einddatum before startdatum', () => {
      const result = validateCreateSprint({
        volgnummer: 1,
        startdatum: '2026-01-26',
        einddatum: '2026-01-13',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('einddatum must be after startdatum');
    });
  });

  describe('validateUpdateSprint', () => {
    it('should accept valid partial input', () => {
      const result = validateUpdateSprint({ volgnummer: 2 });
      expect(result.valid).toBe(true);
    });

    it('should accept empty input', () => {
      const result = validateUpdateSprint({});
      expect(result.valid).toBe(true);
    });
  });
});

describe('Goal validation', () => {
  describe('validateCreateGoal', () => {
    const validInput = {
      sprint_id: '550e8400-e29b-41d4-a716-446655440000',
      titel: 'Test goal',
      beschrijving: 'Test description',
      eigenaar: 'Test owner',
      geschatte_uren: 8,
    };

    it('should accept valid input', () => {
      const result = validateCreateGoal(validInput);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid sprint_id', () => {
      const result = validateCreateGoal({ ...validInput, sprint_id: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('sprint_id must be a valid UUID');
    });

    it('should reject empty titel', () => {
      const result = validateCreateGoal({ ...validInput, titel: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('titel is required');
    });

    it('should reject titel exceeding 200 chars', () => {
      const result = validateCreateGoal({ ...validInput, titel: 'a'.repeat(201) });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('titel must not exceed 200 characters');
    });

    it('should reject invalid geschatte_uren precision', () => {
      const result = validateCreateGoal({ ...validInput, geschatte_uren: 8.1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('geschatte_uren must be in 0.25 hour increments');
    });
  });

  describe('validateUpdateGoal', () => {
    it('should accept valid partial input', () => {
      const result = validateUpdateGoal({ werkelijke_uren: 10.5 });
      expect(result.valid).toBe(true);
    });

    it('should accept null werkelijke_uren', () => {
      const result = validateUpdateGoal({ werkelijke_uren: null });
      expect(result.valid).toBe(true);
    });
  });
});

describe('Success criterion validation', () => {
  describe('validateCreateSuccessCriterion', () => {
    it('should accept valid input', () => {
      const result = validateCreateSuccessCriterion({
        goal_id: '550e8400-e29b-41d4-a716-446655440000',
        beschrijving: 'Test criterion',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject beschrijving exceeding 500 chars', () => {
      const result = validateCreateSuccessCriterion({
        goal_id: '550e8400-e29b-41d4-a716-446655440000',
        beschrijving: 'a'.repeat(501),
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('beschrijving must not exceed 500 characters');
    });
  });

  describe('validateUpdateSuccessCriterion', () => {
    it('should accept valid voltooid update', () => {
      const result = validateUpdateSuccessCriterion({ voltooid: true });
      expect(result.valid).toBe(true);
    });
  });
});

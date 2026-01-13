import { SprintService } from '../src/services/sprint-service';
import { createTestDatabase } from '../src/db/database';
import Database from 'better-sqlite3';

describe('SprintService', () => {
  let db: Database.Database;
  let service: SprintService;

  beforeEach(() => {
    db = createTestDatabase();
    service = new SprintService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should create a sprint with valid input', () => {
      const sprint = service.create({
        volgnummer: 1,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      });

      expect(sprint.id).toBeDefined();
      expect(sprint.id).toHaveLength(36);
      expect(sprint.volgnummer).toBe(1);
      expect(sprint.startdatum).toBe('2026-01-13');
      expect(sprint.einddatum).toBe('2026-01-26');
    });

    it('should reject invalid input', () => {
      expect(() => service.create({
        volgnummer: 0,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      })).toThrow('Validation failed');
    });

    it('should reject duplicate volgnummer', () => {
      service.create({
        volgnummer: 1,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      });

      expect(() => service.create({
        volgnummer: 1,
        startdatum: '2026-01-27',
        einddatum: '2026-02-09',
      })).toThrow();
    });
  });

  describe('getById', () => {
    it('should return sprint by ID', () => {
      const created = service.create({
        volgnummer: 1,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      });

      const found = service.getById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', () => {
      const found = service.getById('550e8400-e29b-41d4-a716-446655440000');
      expect(found).toBeNull();
    });

    it('should throw for invalid UUID format', () => {
      expect(() => service.getById('invalid')).toThrow('Invalid sprint ID format');
    });
  });

  describe('getByVolgnummer', () => {
    it('should return sprint by volgnummer', () => {
      service.create({
        volgnummer: 1,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      });

      const found = service.getByVolgnummer(1);
      expect(found).not.toBeNull();
      expect(found?.volgnummer).toBe(1);
    });

    it('should return null for non-existent volgnummer', () => {
      const found = service.getByVolgnummer(99);
      expect(found).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all sprints ordered by volgnummer', () => {
      service.create({ volgnummer: 2, startdatum: '2026-01-27', einddatum: '2026-02-09' });
      service.create({ volgnummer: 1, startdatum: '2026-01-13', einddatum: '2026-01-26' });
      service.create({ volgnummer: 3, startdatum: '2026-02-10', einddatum: '2026-02-23' });

      const sprints = service.getAll();
      expect(sprints).toHaveLength(3);
      expect(sprints[0]?.volgnummer).toBe(1);
      expect(sprints[1]?.volgnummer).toBe(2);
      expect(sprints[2]?.volgnummer).toBe(3);
    });

    it('should return empty array when no sprints', () => {
      const sprints = service.getAll();
      expect(sprints).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update sprint fields', () => {
      const created = service.create({
        volgnummer: 1,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      });

      const updated = service.update(created.id, {
        einddatum: '2026-01-27',
      });

      expect(updated.einddatum).toBe('2026-01-27');
      expect(updated.startdatum).toBe('2026-01-13');
    });

    it('should throw for non-existent sprint', () => {
      expect(() => service.update('550e8400-e29b-41d4-a716-446655440000', {
        volgnummer: 2,
      })).toThrow('Sprint with ID 550e8400-e29b-41d4-a716-446655440000 not found');
    });
  });

  describe('delete', () => {
    it('should delete sprint', () => {
      const created = service.create({
        volgnummer: 1,
        startdatum: '2026-01-13',
        einddatum: '2026-01-26',
      });

      const deleted = service.delete(created.id);
      expect(deleted).toBe(true);

      const found = service.getById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent sprint', () => {
      const deleted = service.delete('550e8400-e29b-41d4-a716-446655440000');
      expect(deleted).toBe(false);
    });
  });

  describe('getNextVolgnummer', () => {
    it('should return 1 for empty database', () => {
      expect(service.getNextVolgnummer()).toBe(1);
    });

    it('should return next number after existing sprints', () => {
      service.create({ volgnummer: 1, startdatum: '2026-01-13', einddatum: '2026-01-26' });
      service.create({ volgnummer: 2, startdatum: '2026-01-27', einddatum: '2026-02-09' });

      expect(service.getNextVolgnummer()).toBe(3);
    });
  });

  describe('getSuggestedNextDates', () => {
    it('should suggest dates starting after last sprint', () => {
      service.create({ volgnummer: 1, startdatum: '2026-01-13', einddatum: '2026-01-26' });

      const suggested = service.getSuggestedNextDates();
      expect(suggested.startdatum).toBe('2026-01-27');
      expect(suggested.einddatum).toBe('2026-02-09');
    });

    it('should suggest 14-day sprints', () => {
      service.create({ volgnummer: 1, startdatum: '2026-01-13', einddatum: '2026-01-26' });

      const suggested = service.getSuggestedNextDates();
      const start = new Date(suggested.startdatum);
      const end = new Date(suggested.einddatum);
      const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

      expect(days).toBe(13); // 14 days inclusive (0 to 13)
    });
  });
});

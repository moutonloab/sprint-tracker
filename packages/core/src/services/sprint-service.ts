import { v4 as uuidv4 } from 'uuid';
import { Sprint, CreateSprintInput, UpdateSprintInput } from '../types';
import { validateCreateSprint, validateUpdateSprint, isValidUUID } from '../validation';
import { StorageAdapter } from '../interfaces/storage';

export class SprintService {
  constructor(private storage: StorageAdapter) {}

  /**
   * Create a new sprint
   */
  async create(input: CreateSprintInput): Promise<Sprint> {
    const validation = validateCreateSprint(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const id = uuidv4();
    const sprint: Sprint = {
      id,
      volgnummer: input.volgnummer,
      startdatum: input.startdatum,
      einddatum: input.einddatum,
    };

    await this.storage.createSprint(sprint);
    return sprint;
  }

  /**
   * Get a sprint by ID
   */
  async getById(id: string): Promise<Sprint | null> {
    if (!isValidUUID(id)) {
      throw new Error('Invalid sprint ID format');
    }
    return this.storage.getSprintById(id);
  }

  /**
   * Get a sprint by volgnummer
   */
  async getByVolgnummer(volgnummer: number): Promise<Sprint | null> {
    return this.storage.getSprintByVolgnummer(volgnummer);
  }

  /**
   * Get all sprints ordered by volgnummer
   */
  async getAll(): Promise<Sprint[]> {
    return this.storage.getAllSprints();
  }

  /**
   * Get the current sprint (based on today's date)
   */
  async getCurrent(): Promise<Sprint | null> {
    const today = new Date().toISOString().split('T')[0]!;
    return this.storage.getCurrentSprint(today);
  }

  /**
   * Get the latest sprint
   */
  async getLatest(): Promise<Sprint | null> {
    return this.storage.getLatestSprint();
  }

  /**
   * Update a sprint
   */
  async update(id: string, input: UpdateSprintInput): Promise<Sprint> {
    if (!isValidUUID(id)) {
      throw new Error('Invalid sprint ID format');
    }

    const validation = validateUpdateSprint(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const existing = await this.getById(id);
    if (existing === null) {
      throw new Error(`Sprint with ID ${id} not found`);
    }

    const updates: Partial<Sprint> = {};
    if (input.volgnummer !== undefined) updates.volgnummer = input.volgnummer;
    if (input.startdatum !== undefined) updates.startdatum = input.startdatum;
    if (input.einddatum !== undefined) updates.einddatum = input.einddatum;

    if (Object.keys(updates).length > 0) {
      await this.storage.updateSprint(id, updates);
    }

    return (await this.getById(id))!;
  }

  /**
   * Delete a sprint (cascades to goals and criteria)
   */
  async delete(id: string): Promise<boolean> {
    if (!isValidUUID(id)) {
      throw new Error('Invalid sprint ID format');
    }
    return this.storage.deleteSprint(id);
  }

  /**
   * Get the next available volgnummer
   */
  async getNextVolgnummer(): Promise<number> {
    const max = await this.storage.getMaxVolgnummer();
    return (max ?? 0) + 1;
  }

  /**
   * Calculate suggested dates for next sprint (2-week cycle)
   */
  async getSuggestedNextDates(): Promise<{ startdatum: string; einddatum: string }> {
    const latest = await this.getLatest();

    let startDate: Date;
    if (latest !== null) {
      startDate = new Date(latest.einddatum);
      startDate.setDate(startDate.getDate() + 1);
    } else {
      startDate = new Date();
      const day = startDate.getDay();
      const diff = day === 0 ? 1 : (day === 6 ? 2 : 0);
      startDate.setDate(startDate.getDate() + diff);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 13);

    return {
      startdatum: startDate.toISOString().split('T')[0]!,
      einddatum: endDate.toISOString().split('T')[0]!,
    };
  }
}

import { useState, useEffect, FormEvent } from 'react';
import { useServices } from '../../context/StorageContext';

interface SprintFormProps {
  onSubmit: (data: { volgnummer: number; startdatum: string; einddatum: string }) => Promise<void>;
  onCancel: () => void;
  initialData?: { volgnummer: number; startdatum: string; einddatum: string };
}

export function SprintForm({ onSubmit, onCancel, initialData }: SprintFormProps) {
  const { sprintService } = useServices();
  const [volgnummer, setVolgnummer] = useState(initialData?.volgnummer ?? 1);
  const [startdatum, setStartdatum] = useState(initialData?.startdatum ?? '');
  const [einddatum, setEinddatum] = useState(initialData?.einddatum ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-fill suggested values for new sprints
    if (!initialData) {
      loadSuggestions();
    }
  }, []);

  async function loadSuggestions() {
    const [nextNum, dates] = await Promise.all([
      sprintService.getNextVolgnummer(),
      sprintService.getSuggestedNextDates(),
    ]);
    setVolgnummer(nextNum);
    setStartdatum(dates.startdatum);
    setEinddatum(dates.einddatum);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({ volgnummer, startdatum, einddatum });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sprint');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="sprint-form card">
      <h4>{initialData ? 'Edit Sprint' : 'Create Sprint'}</h4>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-field">
        <label htmlFor="volgnummer">Sprint Number</label>
        <input
          type="number"
          id="volgnummer"
          value={volgnummer}
          onChange={e => setVolgnummer(parseInt(e.target.value) || 1)}
          min="1"
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="startdatum">Start Date</label>
        <input
          type="date"
          id="startdatum"
          value={startdatum}
          onChange={e => setStartdatum(e.target.value)}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="einddatum">End Date</label>
        <input
          type="date"
          id="einddatum"
          value={einddatum}
          onChange={e => setEinddatum(e.target.value)}
          min={startdatum}
          required
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="button primary" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Sprint'}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

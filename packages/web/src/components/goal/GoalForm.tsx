import { useState, FormEvent } from 'react';

interface GoalFormProps {
  onSubmit: (data: {
    titel: string;
    beschrijving: string;
    eigenaar: string;
    geschatte_uren: number;
  }) => Promise<void>;
  onCancel: () => void;
  initialData?: {
    titel: string;
    beschrijving: string;
    eigenaar: string;
    geschatte_uren: number;
  };
}

export function GoalForm({ onSubmit, onCancel, initialData }: GoalFormProps) {
  const [titel, setTitel] = useState(initialData?.titel ?? '');
  const [beschrijving, setBeschrijving] = useState(initialData?.beschrijving ?? '');
  const [eigenaar, setEigenaar] = useState(initialData?.eigenaar ?? '');
  const [geschatte_uren, setGeschatteUren] = useState(initialData?.geschatte_uren ?? 4);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({ titel, beschrijving, eigenaar, geschatte_uren });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="goal-form card">
      <h4>{initialData ? 'Edit Goal' : 'Add Goal'}</h4>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-field">
        <label htmlFor="titel">Title</label>
        <input
          type="text"
          id="titel"
          value={titel}
          onChange={e => setTitel(e.target.value)}
          maxLength={200}
          required
          placeholder="What do you want to achieve?"
        />
      </div>

      <div className="form-field">
        <label htmlFor="beschrijving">Description</label>
        <textarea
          id="beschrijving"
          value={beschrijving}
          onChange={e => setBeschrijving(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Describe the goal in more detail..."
        />
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="eigenaar">Owner</label>
          <input
            type="text"
            id="eigenaar"
            value={eigenaar}
            onChange={e => setEigenaar(e.target.value)}
            maxLength={50}
            required
            placeholder="Who is responsible?"
          />
        </div>

        <div className="form-field">
          <label htmlFor="geschatte_uren">Estimated Hours</label>
          <input
            type="number"
            id="geschatte_uren"
            value={geschatte_uren}
            onChange={e => setGeschatteUren(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.25"
            required
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="button primary" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Goal'}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

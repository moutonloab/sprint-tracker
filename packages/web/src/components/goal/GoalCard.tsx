import { Goal, SuccessCriterion } from '@sprint-tracker/core';

interface GoalCardProps {
  goal: Goal;
  criteria: SuccessCriterion[];
  onToggleAchieved: (goalId: string, achieved: boolean) => Promise<void>;
  onToggleCriterion: (criterionId: string) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
}

export function GoalCard({
  goal,
  criteria,
  onToggleAchieved,
  onToggleCriterion,
  onDelete,
}: GoalCardProps) {
  const completedCriteria = criteria.filter(c => c.voltooid).length;
  const totalCriteria = criteria.length;
  const progressPercent = totalCriteria > 0 ? Math.round((completedCriteria / totalCriteria) * 100) : 0;

  return (
    <li className={`goal-card ${goal.behaald ? 'achieved' : ''}`}>
      <article aria-labelledby={`goal-${goal.id}-title`}>
        <header className="goal-header">
          <div className="goal-status-toggle">
            <button
              className={`status-button ${goal.behaald ? 'achieved' : ''}`}
              onClick={() => onToggleAchieved(goal.id, !goal.behaald)}
              aria-pressed={goal.behaald ?? false}
              aria-label={goal.behaald ? 'Mark as not achieved' : 'Mark as achieved'}
            >
              {goal.behaald ? '●' : '○'}
            </button>
          </div>

          <div className="goal-info">
            <h4 id={`goal-${goal.id}-title`}>{goal.titel}</h4>
            <p className="goal-meta">
              <span className="owner">{goal.eigenaar}</span>
              <span className="hours">
                {goal.werkelijke_uren ?? 0}/{goal.geschatte_uren}h
              </span>
            </p>
          </div>

          <button
            className="delete-button"
            onClick={() => onDelete(goal.id)}
            aria-label={`Delete goal: ${goal.titel}`}
          >
            ×
          </button>
        </header>

        {goal.beschrijving && (
          <p className="goal-description">{goal.beschrijving}</p>
        )}

        {criteria.length > 0 && (
          <div className="criteria-section">
            <div className="criteria-progress">
              <progress
                value={progressPercent}
                max="100"
                aria-label={`Criteria progress: ${progressPercent}%`}
              />
              <span className="progress-text">
                {completedCriteria}/{totalCriteria} criteria
              </span>
            </div>

            <ul className="criteria-list" role="list">
              {criteria.map(criterion => (
                <li key={criterion.id} className="criterion-item">
                  <label className="criterion-label">
                    <input
                      type="checkbox"
                      checked={criterion.voltooid}
                      onChange={() => onToggleCriterion(criterion.id)}
                      aria-describedby={`criterion-${criterion.id}`}
                    />
                    <span id={`criterion-${criterion.id}`}>{criterion.beschrijving}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {goal.behaald && (goal.toelichting || goal.geleerde_lessen) && (
          <div className="goal-completion-notes">
            {goal.toelichting && (
              <div className="note">
                <strong>Notes:</strong> {goal.toelichting}
              </div>
            )}
            {goal.geleerde_lessen && (
              <div className="note">
                <strong>Lessons learned:</strong> {goal.geleerde_lessen}
              </div>
            )}
          </div>
        )}
      </article>
    </li>
  );
}

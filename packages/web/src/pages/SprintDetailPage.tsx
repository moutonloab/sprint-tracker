import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Sprint, Goal, SuccessCriterion } from '@sprint-tracker/core';
import { useServices } from '../context/StorageContext';
import { GoalForm } from '../components/goal/GoalForm';
import { GoalCard } from '../components/goal/GoalCard';

export function SprintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sprintService, goalService, criterionService } = useServices();

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [criteriaMap, setCriteriaMap] = useState<Map<string, SuccessCriterion[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  async function loadData() {
    if (!id) return;

    try {
      const sprintData = await sprintService.getById(id);
      if (!sprintData) {
        setError('Sprint not found');
        return;
      }

      setSprint(sprintData);

      const goalsData = await goalService.getBySprintId(id);
      setGoals(goalsData);

      // Load criteria for all goals
      const criteriaEntries = await Promise.all(
        goalsData.map(async goal => {
          const criteria = await criterionService.getByGoalId(goal.id);
          return [goal.id, criteria] as const;
        })
      );
      setCriteriaMap(new Map(criteriaEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sprint');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGoal(data: {
    titel: string;
    beschrijving: string;
    eigenaar: string;
    geschatte_uren: number;
  }) {
    if (!id) return;

    await goalService.create({
      sprint_id: id,
      ...data,
    });
    await loadData();
    setShowGoalForm(false);
  }

  async function handleToggleGoal(goalId: string, achieved: boolean) {
    await goalService.markAchieved(goalId, achieved);
    await loadData();
  }

  async function handleToggleCriterion(criterionId: string) {
    await criterionService.toggle(criterionId);
    await loadData();
  }

  async function handleDeleteGoal(goalId: string) {
    if (confirm('Delete this goal and all its criteria?')) {
      await goalService.delete(goalId);
      await loadData();
    }
  }

  if (loading) {
    return <div aria-busy="true">Loading sprint...</div>;
  }

  if (error || !sprint) {
    return (
      <div className="error-page">
        <h2>Error</h2>
        <p>{error || 'Sprint not found'}</p>
        <Link to="/sprints">Back to Sprints</Link>
      </div>
    );
  }

  const stats = {
    total: goals.length,
    completed: goals.filter(g => g.behaald).length,
    estimatedHours: goals.reduce((sum, g) => sum + g.geschatte_uren, 0),
    actualHours: goals.reduce((sum, g) => sum + (g.werkelijke_uren ?? 0), 0),
  };

  return (
    <div className="sprint-detail-page">
      <header className="page-header">
        <Link to="/sprints" className="back-link">&larr; Back to Sprints</Link>
        <h2>Sprint #{sprint.volgnummer}</h2>
        <p className="sprint-dates">
          <time dateTime={sprint.startdatum}>{sprint.startdatum}</time>
          {' to '}
          <time dateTime={sprint.einddatum}>{sprint.einddatum}</time>
        </p>
      </header>

      <section className="sprint-stats" aria-label="Sprint statistics">
        <div className="stat">
          <span className="stat-value">{stats.completed}/{stats.total}</span>
          <span className="stat-label">Goals Completed</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.actualHours}/{stats.estimatedHours}h</span>
          <span className="stat-label">Hours</span>
        </div>
      </section>

      <section className="goals-section" aria-labelledby="goals-heading">
        <header className="section-header">
          <h3 id="goals-heading">Goals</h3>
          <button
            className="button primary"
            onClick={() => setShowGoalForm(true)}
            aria-expanded={showGoalForm}
          >
            Add Goal
          </button>
        </header>

        {showGoalForm && (
          <GoalForm
            onSubmit={handleCreateGoal}
            onCancel={() => setShowGoalForm(false)}
          />
        )}

        {goals.length === 0 ? (
          <p className="empty-state">No goals in this sprint yet.</p>
        ) : (
          <ul className="goal-list" role="list">
            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                criteria={criteriaMap.get(goal.id) ?? []}
                onToggleAchieved={handleToggleGoal}
                onToggleCriterion={handleToggleCriterion}
                onDelete={handleDeleteGoal}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

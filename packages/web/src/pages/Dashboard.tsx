import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sprint, Goal } from '@sprint-tracker/core';
import { useServices } from '../context/StorageContext';

export function Dashboard() {
  const { sprintService, goalService } = useServices();
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stats, setStats] = useState<{
    totalGoals: number;
    completedGoals: number;
    estimatedHours: number;
    actualHours: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const sprint = await sprintService.getCurrent();
        setCurrentSprint(sprint);

        if (sprint) {
          const [sprintGoals, sprintStats] = await Promise.all([
            goalService.getBySprintId(sprint.id),
            goalService.getSprintStats(sprint.id),
          ]);
          setGoals(sprintGoals);
          setStats(sprintStats);
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [sprintService, goalService]);

  if (loading) {
    return <div aria-busy="true">Loading dashboard...</div>;
  }

  if (!currentSprint) {
    return (
      <div className="dashboard">
        <h2>Dashboard</h2>
        <div className="empty-state">
          <p>No active sprint found.</p>
          <Link to="/sprints" className="button">
            Create a Sprint
          </Link>
        </div>
      </div>
    );
  }

  const progressPercentage = stats && stats.totalGoals > 0
    ? Math.round((stats.completedGoals / stats.totalGoals) * 100)
    : 0;

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>

      <section className="current-sprint" aria-labelledby="current-sprint-heading">
        <h3 id="current-sprint-heading">
          Current Sprint #{currentSprint.volgnummer}
        </h3>
        <p className="sprint-dates">
          <time dateTime={currentSprint.startdatum}>{currentSprint.startdatum}</time>
          {' to '}
          <time dateTime={currentSprint.einddatum}>{currentSprint.einddatum}</time>
        </p>

        {stats && (
          <div className="sprint-stats">
            <div className="stat">
              <span className="stat-value">{stats.completedGoals}/{stats.totalGoals}</span>
              <span className="stat-label">Goals Completed</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.actualHours}/{stats.estimatedHours}h</span>
              <span className="stat-label">Hours Logged</span>
            </div>
            <div className="progress-container">
              <progress
                value={progressPercentage}
                max="100"
                aria-label={`Sprint progress: ${progressPercentage}%`}
              />
              <span className="progress-label">{progressPercentage}%</span>
            </div>
          </div>
        )}

        <Link to={`/sprints/${currentSprint.id}`} className="button">
          View Sprint Details
        </Link>
      </section>

      <section className="goals-overview" aria-labelledby="goals-heading">
        <h3 id="goals-heading">Goals</h3>
        {goals.length === 0 ? (
          <p>No goals in this sprint yet.</p>
        ) : (
          <ul className="goal-list">
            {goals.map(goal => (
              <li key={goal.id} className={`goal-item ${goal.behaald ? 'completed' : ''}`}>
                <span className="goal-status" aria-label={goal.behaald ? 'Completed' : 'In progress'}>
                  {goal.behaald ? '●' : '○'}
                </span>
                <span className="goal-title">{goal.titel}</span>
                <span className="goal-owner">{goal.eigenaar}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

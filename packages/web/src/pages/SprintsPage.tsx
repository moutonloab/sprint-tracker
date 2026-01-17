import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sprint } from '@sprint-tracker/core';
import { useServices } from '../context/StorageContext';
import { SprintForm } from '../components/sprint/SprintForm';

export function SprintsPage() {
  const { sprintService } = useServices();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentSprintId, setCurrentSprintId] = useState<string | null>(null);

  useEffect(() => {
    loadSprints();
  }, []);

  async function loadSprints() {
    try {
      const [allSprints, current] = await Promise.all([
        sprintService.getAll(),
        sprintService.getCurrent(),
      ]);
      setSprints(allSprints.reverse()); // Show newest first
      setCurrentSprintId(current?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSprint(data: { volgnummer: number; startdatum: string; einddatum: string }) {
    await sprintService.create(data);
    await loadSprints();
    setShowForm(false);
  }

  async function handleDeleteSprint(id: string) {
    if (confirm('Are you sure you want to delete this sprint? All goals and criteria will also be deleted.')) {
      await sprintService.delete(id);
      await loadSprints();
    }
  }

  if (loading) {
    return <div aria-busy="true">Loading sprints...</div>;
  }

  return (
    <div className="sprints-page">
      <header className="page-header">
        <h2>Sprints</h2>
        <button
          className="button primary"
          onClick={() => setShowForm(true)}
          aria-expanded={showForm}
        >
          Create Sprint
        </button>
      </header>

      {showForm && (
        <SprintForm
          onSubmit={handleCreateSprint}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sprints.length === 0 ? (
        <div className="empty-state">
          <p>No sprints yet. Create your first sprint to get started!</p>
        </div>
      ) : (
        <ul className="sprint-list" role="list">
          {sprints.map(sprint => (
            <li key={sprint.id} className="sprint-card">
              <article aria-labelledby={`sprint-${sprint.id}-title`}>
                <header>
                  <h3 id={`sprint-${sprint.id}-title`}>
                    Sprint #{sprint.volgnummer}
                    {sprint.id === currentSprintId && (
                      <span className="badge current">Current</span>
                    )}
                  </h3>
                  <p className="sprint-dates">
                    <time dateTime={sprint.startdatum}>{sprint.startdatum}</time>
                    {' to '}
                    <time dateTime={sprint.einddatum}>{sprint.einddatum}</time>
                  </p>
                </header>
                <footer className="sprint-actions">
                  <Link to={`/sprints/${sprint.id}`} className="button">
                    View Details
                  </Link>
                  <button
                    className="button danger"
                    onClick={() => handleDeleteSprint(sprint.id)}
                    aria-label={`Delete sprint ${sprint.volgnummer}`}
                  >
                    Delete
                  </button>
                </footer>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

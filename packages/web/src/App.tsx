import { Routes, Route } from 'react-router-dom';
import { useStorage } from './context/StorageContext';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { SprintsPage } from './pages/SprintsPage';
import { SprintDetailPage } from './pages/SprintDetailPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const { isReady, error } = useStorage();

  if (error) {
    return (
      <div className="error-container" role="alert">
        <h1>Storage Error</h1>
        <p>{error}</p>
        <p>Please ensure your browser supports IndexedDB and try again.</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="loading-container" aria-busy="true" aria-live="polite">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sprints" element={<SprintsPage />} />
        <Route path="/sprints/:id" element={<SprintDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </MainLayout>
  );
}

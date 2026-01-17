import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/sprints', label: 'Sprints' },
    { path: '/settings', label: 'Settings' },
  ];

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>
          <Link to="/">Sprint Tracker</Link>
        </h1>
        <nav aria-label="Main navigation">
          <ul className="nav-list">
            {navItems.map(item => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={location.pathname === item.path ? 'active' : ''}
                  aria-current={location.pathname === item.path ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="app-main">
        {children}
      </main>

      <footer className="app-footer">
        <p>Sprint Tracker - Lightweight sprint tracking for 2-week cycles</p>
      </footer>
    </div>
  );
}

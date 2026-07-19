import { Link, Outlet } from 'react-router-dom';
import { useBootstrapStaffAuth } from '../features/auth/useBootstrapStaffAuth';
import { useStaffAuth } from '../features/auth/useStaffAuth';

export function AppShell() {
  useBootstrapStaffAuth();
  const { isAuthenticated, isInitialized, user, logout } = useStaffAuth();

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border px-4 py-3">
        <nav className="flex items-center gap-6">
          <span className="text-lg font-semibold">Backoffice</span>
          {isInitialized && isAuthenticated && (
            <>
              <Link to="/" className="text-sm text-text-secondary hover:text-text-primary">
                Settlement
              </Link>
              {(user?.role === 'ADMIN' || user?.role === 'TRADING') && (
                <Link to="/markets" className="text-sm text-text-secondary hover:text-text-primary">
                  Markets
                </Link>
              )}
              {(user?.role === 'ADMIN' || user?.role === 'CMS') && (
                <Link
                  to="/team-colors"
                  className="text-sm text-text-secondary hover:text-text-primary"
                >
                  Team colors
                </Link>
              )}
              {user?.role === 'ADMIN' && (
                <>
                  <Link
                    to="/staff-users"
                    className="text-sm text-text-secondary hover:text-text-primary"
                  >
                    Staff users
                  </Link>
                  <Link
                    to="/audit-log"
                    className="text-sm text-text-secondary hover:text-text-primary"
                  >
                    Audit log
                  </Link>
                  <Link
                    to="/reports"
                    className="text-sm text-text-secondary hover:text-text-primary"
                  >
                    Reports
                  </Link>
                </>
              )}
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="text-text-secondary">
                  {user?.username} <span className="text-text-muted">({user?.role})</span>
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="text-text-secondary hover:text-text-primary"
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </nav>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}

import { Link, Outlet } from 'react-router-dom';
import { useBootstrapMasterAuth } from '../features/auth/useBootstrapMasterAuth';
import { useMasterAuth } from '../features/auth/useMasterAuth';

export function AppShell() {
  useBootstrapMasterAuth();
  const { isAuthenticated, isInitialized, user, logout } = useMasterAuth();

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border px-4 py-3">
        <nav className="flex items-center gap-6">
          <span className="text-lg font-semibold">Master Backoffice</span>
          {isInitialized && isAuthenticated && (
            <>
              <Link to="/" className="text-sm text-text-secondary hover:text-text-primary">
                Brands
              </Link>
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="text-text-secondary">{user?.username}</span>
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

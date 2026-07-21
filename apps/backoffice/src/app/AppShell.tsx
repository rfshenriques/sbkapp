import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useBootstrapStaffAuth } from '../features/auth/useBootstrapStaffAuth';
import type { StaffRole } from '../features/auth/staffAuthStore';
import { useStaffAuth } from '../features/auth/useStaffAuth';
import { useScrollLock } from '../lib/useScrollLock';

interface NavItem {
  to: string;
  label: string;
  roles?: StaffRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Settlement' },
  { to: '/markets', label: 'Markets', roles: ['ADMIN', 'TRADING'] },
  { to: '/team-colors', label: 'Team colors', roles: ['ADMIN', 'CMS'] },
  { to: '/display-names', label: 'Display names', roles: ['ADMIN', 'CMS'] },
  { to: '/competition-ranking', label: 'Competition ranking', roles: ['ADMIN', 'CMS'] },
  { to: '/cms-images', label: 'CMS images', roles: ['ADMIN', 'CMS'] },
  { to: '/staff-users', label: 'Staff users', roles: ['ADMIN'] },
  { to: '/audit-log', label: 'Audit log', roles: ['ADMIN'] },
  { to: '/reports', label: 'Reports', roles: ['ADMIN'] },
];

export function AppShell() {
  useBootstrapStaffAuth();
  const { isAuthenticated, isInitialized, user, logout } = useStaffAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();

  useScrollLock(isDrawerOpen);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user?.role && item.roles.includes(user.role)));

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border px-4 py-3">
        <nav className="flex items-center gap-6">
          {isInitialized && isAuthenticated && (
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={isDrawerOpen}
              onClick={() => setIsDrawerOpen(true)}
              className="-ml-1 flex h-8 w-8 shrink-0 flex-col items-center justify-center gap-1 rounded-md hover:bg-surface sm:hidden"
            >
              <span className="h-0.5 w-5 rounded bg-text-primary" />
              <span className="h-0.5 w-5 rounded bg-text-primary" />
              <span className="h-0.5 w-5 rounded bg-text-primary" />
            </button>
          )}
          <span className="text-lg font-semibold">Backoffice</span>
          {isInitialized && isAuthenticated && (
            <>
              <div className="hidden items-center gap-6 sm:flex">
                {visibleItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="text-sm text-text-secondary hover:text-text-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="hidden text-text-secondary sm:inline">
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

      {isDrawerOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative flex h-full w-72 max-w-[80vw] flex-col overflow-y-auto border-r border-border bg-background p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-semibold">Backoffice</span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setIsDrawerOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            <div className="mb-3 text-sm text-text-secondary">
              {user?.username} <span className="text-text-muted">({user?.role})</span>
            </div>
            <nav className="flex flex-col gap-1">
              {visibleItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1400px] p-4">
        <Outlet />
      </main>
    </div>
  );
}

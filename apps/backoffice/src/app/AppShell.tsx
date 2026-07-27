import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useBootstrapStaffAuth } from '../features/auth/useBootstrapStaffAuth';
import type { StaffRole } from '../features/auth/staffAuthStore';
import { useStaffAuth } from '../features/auth/useStaffAuth';
import { useScrollLock } from '../lib/useScrollLock';
import { ChevronIcon } from '../components/ui/ChevronIcon';

interface NavItem {
  to: string;
  label: string;
  /** Omit for items every authenticated staff member can see (e.g. Settlement). */
  roles?: StaffRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Trading',
    items: [
      { to: '/', label: 'Settlement' },
      { to: '/trading', label: 'Suspensions', roles: ['ADMIN', 'TRADING'] },
      { to: '/competition-tiers', label: 'Competition tiers', roles: ['ADMIN', 'TRADING'] },
      { to: '/margins', label: 'Margins', roles: ['ADMIN', 'TRADING'] },
      { to: '/odds-overrides', label: 'Odds management', roles: ['ADMIN', 'TRADING'] },
      { to: '/manual-markets', label: 'Manual markets', roles: ['ADMIN', 'TRADING'] },
      { to: '/odds-ladder', label: 'Odds ladder', roles: ['ADMIN', 'TRADING'] },
      { to: '/boosts', label: 'Boosts', roles: ['ADMIN', 'TRADING'] },
      { to: '/stake-limits', label: 'Stake limits', roles: ['ADMIN', 'TRADING'] },
      { to: '/competition-ranking', label: 'Competition rankings', roles: ['ADMIN', 'CMS'] },
    ],
  },
  {
    label: 'Campaigns',
    items: [
      { to: '/bet-and-get', label: 'Bet & Get', roles: ['ADMIN', 'TRADING'] },
      { to: '/deposit-campaigns', label: 'Deposit campaigns', roles: ['ADMIN', 'TRADING'] },
      { to: '/acca-boost', label: 'Acca boost', roles: ['ADMIN', 'TRADING'] },
      { to: '/acca-rollback', label: 'Acca rollback', roles: ['ADMIN', 'TRADING'] },
      { to: '/insurance-bet', label: 'Insurance bet', roles: ['ADMIN', 'TRADING'] },
      { to: '/freebets', label: 'Freebets', roles: ['ADMIN', 'CRM'] },
    ],
  },
  {
    label: 'CMS',
    items: [
      { to: '/cms-images', label: 'Images', roles: ['ADMIN', 'CMS'] },
      { to: '/cms-sponsors', label: 'Sponsors', roles: ['ADMIN', 'CMS'] },
      { to: '/cms-payments', label: 'Payments', roles: ['ADMIN', 'CMS'] },
      { to: '/cms-promo-cards', label: 'Promo Cards', roles: ['ADMIN', 'CMS'] },
      { to: '/cms-quicklinks', label: 'Quicklinks', roles: ['ADMIN', 'CMS'] },
    ],
  },
  {
    label: 'CRM',
    items: [{ to: '/player-segments', label: 'Player segments', roles: ['ADMIN', 'CRM'] }],
  },
  {
    label: 'Customization',
    items: [
      { to: '/display-names', label: 'Translations', roles: ['ADMIN', 'CMS'] },
      { to: '/team-colors', label: 'Team colors', roles: ['ADMIN', 'CMS'] },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports', label: 'Business reports', roles: ['ADMIN'] },
      { to: '/bet-history', label: 'Bet history', roles: ['ADMIN'] },
      { to: '/registrations', label: 'Registrations', roles: ['ADMIN'] },
      { to: '/marketing-spend', label: 'Marketing spend', roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Staff',
    items: [
      { to: '/staff-users', label: 'Staff users', roles: ['ADMIN'] },
      { to: '/audit-log', label: 'Audit log', roles: ['ADMIN'] },
    ],
  },
];

function visibleItemsFor(items: NavItem[], role: StaffRole | undefined): NavItem[] {
  return items.filter((item) => !item.roles || (role && item.roles.includes(role)));
}

export function AppShell() {
  useBootstrapStaffAuth();
  const { isAuthenticated, isInitialized, user, logout } = useStaffAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [expandedMobileGroup, setExpandedMobileGroup] = useState<string | null>(null);
  const location = useLocation();

  useScrollLock(isDrawerOpen);

  useEffect(() => {
    setIsDrawerOpen(false);
    setOpenGroup(null);
  }, [location.pathname]);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: visibleItemsFor(group.items, user?.role),
  })).filter((group) => group.items.length > 0);

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
          )}
        </nav>
      </header>

      {/* Desktop secondary header: one button per group, each opening a
          dropdown of that group's links - only one open at a time. Mobile
          gets the equivalent as expandable sections inside the drawer
          below, since there's no room for a second header row there. */}
      {isInitialized && isAuthenticated && visibleGroups.length > 0 && (
        <div className="relative hidden border-b border-border bg-surface px-4 sm:block">
          <nav className="flex items-center gap-1">
            {visibleGroups.map((group) => (
              <div key={group.label} className="relative">
                <button
                  type="button"
                  aria-expanded={openGroup === group.label}
                  onClick={() => setOpenGroup(openGroup === group.label ? null : group.label)}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium ${
                    openGroup === group.label ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {group.label}
                  <ChevronIcon className={`h-3.5 w-3.5 ${openGroup === group.label ? 'rotate-180' : ''}`} />
                </button>
                {openGroup === group.label && (
                  <div className="absolute left-0 top-full z-30 min-w-48 rounded-b-md border border-t-0 border-border bg-surface py-1 shadow-lg">
                    {group.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="block px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
          {openGroup && (
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpenGroup(null)}
              className="fixed inset-0 z-20 cursor-default"
            />
          )}
        </div>
      )}

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
              {visibleGroups.map((group) => {
                const isExpanded = expandedMobileGroup === group.label;
                return (
                  <div key={group.label}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedMobileGroup(isExpanded ? null : group.label)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-text-primary hover:bg-surface"
                    >
                      {group.label}
                      <ChevronIcon className={`h-4 w-4 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="ml-2 flex flex-col gap-1 border-l border-border pl-3">
                        {group.items.map((item) => (
                          <Link
                            key={item.to}
                            to={item.to}
                            className="rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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

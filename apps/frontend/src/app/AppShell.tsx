import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PageSkeleton } from '../components/ui/PageSkeleton';

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary';

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border px-4 py-3">
        <nav className="flex items-center gap-6">
          <span className="text-lg font-semibold">Sportsbook</span>
          <NavLink to="/" end className={navLinkClassName}>
            Odds Board
          </NavLink>
        </nav>
      </header>
      <main className="p-4">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

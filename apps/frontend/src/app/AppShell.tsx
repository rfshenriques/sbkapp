import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PageSkeleton } from '../components/ui/PageSkeleton';

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200';

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-3">
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

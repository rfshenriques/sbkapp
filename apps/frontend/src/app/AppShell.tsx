import { Suspense, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { BetSlipPanel } from '../features/bet-slip/BetSlipPanel';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { useAuth } from '../features/auth/useAuth';
import { useBootstrapAuth } from '../features/auth/useBootstrapAuth';
import { formatCents, useWallet } from '../features/wallet/useWallet';

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary';

export function AppShell() {
  useBootstrapAuth();
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const selectionCount = useBetSlipStore((state) => state.selections.length);
  const { isAuthenticated, isInitialized, user, logout } = useAuth();
  const { data: wallet } = useWallet();

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border px-4 py-3">
        <nav className="flex items-center gap-6">
          <span className="text-lg font-semibold">Sportsbook</span>
          <NavLink to="/" end className={navLinkClassName}>
            Odds Board
          </NavLink>
          <div className="ml-auto flex items-center gap-3">
            {isInitialized && isAuthenticated ? (
              <>
                {wallet && (
                  <span className="text-sm text-text-secondary">
                    {formatCents(wallet.balanceCents)} (paper)
                  </span>
                )}
                <span className="text-sm text-text-secondary">{user?.username}</span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="text-sm text-text-secondary hover:text-text-primary"
                >
                  Log out
                </button>
              </>
            ) : (
              isInitialized && (
                <NavLink to="/login" className={navLinkClassName}>
                  Log in
                </NavLink>
              )
            )}
            <button
              type="button"
              onClick={() => setIsSlipOpen((open) => !open)}
              className="rounded-md bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-hover"
            >
              Bet Slip{selectionCount > 0 && ` (${selectionCount})`}
            </button>
          </div>
        </nav>
      </header>
      <main className="p-4">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      {isSlipOpen && (
        <>
          <button
            type="button"
            aria-label="Close bet slip"
            className="fixed inset-0 z-10 bg-black/50"
            onClick={() => setIsSlipOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-border bg-background p-4 sm:w-80">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Bet Slip</h2>
              <button
                type="button"
                aria-label="Close bet slip"
                className="text-text-muted hover:text-text-primary"
                onClick={() => setIsSlipOpen(false)}
              >
                ✕
              </button>
            </div>
            <BetSlipPanel />
          </aside>
        </>
      )}
    </div>
  );
}

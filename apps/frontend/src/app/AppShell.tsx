import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { BetSlipPanel } from '../features/bet-slip/BetSlipPanel';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { useBrandTheme } from '../features/brand/useBrandTheme';
import { useAuth } from '../features/auth/useAuth';
import { useBootstrapAuth } from '../features/auth/useBootstrapAuth';
import { formatCents, useWallet } from '../features/wallet/useWallet';

export function AppShell() {
  useBootstrapAuth();
  const brandQuery = useBrandTheme();
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const selections = useBetSlipStore((state) => state.selections);
  const { isAuthenticated, isInitialized, user, logout } = useAuth();
  const { data: wallet } = useWallet();

  const brandName = brandQuery.data?.name ?? 'Sportsbook';
  const combinedOdds = selections.reduce((total, selection) => total * selection.odds, 1);

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="flex shrink-0 items-center gap-2">
            <span className="font-display text-2xl">{brandName}</span>
            <span className="brand-flag" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
          </NavLink>

          <div className="ml-auto flex items-center gap-2">
            {isInitialized && isAuthenticated ? (
              <>
                {wallet && (
                  <span className="hidden text-sm text-text-secondary sm:inline">
                    €{formatCents(wallet.balanceCents)} (paper)
                  </span>
                )}
                <span className="hidden text-sm text-text-secondary sm:inline">
                  {user?.username}
                </span>
                <button type="button" onClick={() => void logout()} className="btn-ghost">
                  Log out
                </button>
              </>
            ) : (
              isInitialized && (
                <>
                  <Link to="/login" className="btn-ghost">
                    Log in
                  </Link>
                  <Link to="/register" className="btn-primary slash">
                    Register
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-4 p-4">
        <main className="min-w-0 flex-1">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>

        {/* Desktop: the bet slip is always visible on the right, not a
            click-to-open drawer - the mobile drawer below is sm:hidden so
            the two never coexist. */}
        <aside className="hidden sm:block sm:w-80 sm:shrink-0">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-xl">Bet Slip</h2>
            <BetSlipPanel />
          </div>
        </aside>
      </div>

      {selections.length > 0 && (
        <button
          type="button"
          onClick={() => setIsSlipOpen(true)}
          className="btn-primary fixed inset-x-3 bottom-14 z-30 flex items-center gap-3 rounded-xl px-[22px] py-[15px] text-left shadow-lg sm:hidden"
        >
          <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-black/20 font-display text-sm">
            {selections.length}
          </span>
          <span className="font-display text-base">
            {selections.length === 1
              ? `Single · ${selections[0]?.odds.toFixed(2)}`
              : `Accumulator · ${combinedOdds.toFixed(2)}`}
          </span>
        </button>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-border bg-background/95 px-1 py-1.5 backdrop-blur sm:hidden"
        style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
        aria-label="App navigation"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-bold ${isActive ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          Home
        </NavLink>
        <button
          type="button"
          onClick={() => setIsSlipOpen(true)}
          className="relative flex flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-bold text-text-secondary"
        >
          Bet slip
          {selections.length > 0 && (
            <span className="absolute -top-1 right-[38%] grid h-[15px] min-w-[15px] place-items-center rounded-lg bg-price-down px-1 text-[9px] font-extrabold text-white">
              {selections.length}
            </span>
          )}
        </button>
      </nav>

      {/* Mobile-only drawer - sm:hidden wrapper keeps this from ever
          coexisting with the persistent desktop aside above. */}
      {isSlipOpen && (
        <div className="sm:hidden">
          <button
            type="button"
            aria-label="Close bet slip"
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setIsSlipOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto border-l border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl">Bet Slip</h2>
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
        </div>
      )}
    </div>
  );
}

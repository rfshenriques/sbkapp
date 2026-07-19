import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { BetSlipPanel } from '../features/bet-slip/BetSlipPanel';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { useBrandTheme } from '../features/brand/useBrandTheme';
import { useAuth } from '../features/auth/useAuth';
import { useBootstrapAuth } from '../features/auth/useBootstrapAuth';
import { formatCents, useWallet } from '../features/wallet/useWallet';
import { Sidebar } from '../features/navigation/Sidebar';
import { HomeIcon, LiveIcon, MyBetsIcon, PromotionsIcon, SearchIcon } from '../components/ui/NavIcons';

export function AppShell() {
  useBootstrapAuth();
  const brandQuery = useBrandTheme();
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const selections = useBetSlipStore((state) => state.selections);
  const { isAuthenticated, isInitialized, user, logout } = useAuth();
  const { data: wallet } = useWallet();

  const brandName = brandQuery.data?.name ?? 'Sportsbook';
  const combinedOdds = selections.reduce((total, selection) => total * selection.odds, 1);

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] items-center gap-4 px-4 py-3">
          <NavLink to="/" className="flex shrink-0 items-center gap-2">
            <span className="font-display text-xl">{brandName}</span>
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
                  <Link to="/register" className="btn-primary">
                    Register
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1680px] gap-4 p-4">
        {/* Desktop: sports navigation is a persistent left column, same
            convention as the bet slip's persistent right column - the
            mobile drawer below is sm:hidden so the two never coexist.
            Deliberately wider than the bet slip column (sm:w-80 below):
            the sport/country/competition tree and Top Competitions list
            need more room to stay readable than the compact bet slip does. */}
        <aside className="hidden sm:block sm:w-96 sm:shrink-0">
          <div className="scrollbar-hide sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-border bg-surface p-4">
            <Sidebar />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>

        {/* Desktop: the bet slip is always visible on the right, not a
            click-to-open drawer - the mobile drawer below is sm:hidden so
            the two never coexist. Full height (not just as tall as its
            content) even when empty, so the promotional empty state has
            room to center itself instead of sitting in a tiny box.
            BetSlipPanel owns its own scroll region and keeps the stake/
            payout calculator fixed at the bottom - this wrapper just gives
            it a bounded height to work within, no overflow of its own. */}
        <aside className="hidden sm:block sm:w-80 sm:shrink-0">
          <div className="sticky top-20 flex h-[calc(100vh-6rem)] flex-col rounded-lg border border-border bg-surface p-4">
            <BetSlipPanel showHistoryTab emptyStateVariant="promotional" />
          </div>
        </aside>
      </div>

      {selections.length > 0 && (
        <button
          type="button"
          onClick={() => setIsSlipOpen(true)}
          // Cleared with the same env(safe-area-inset-bottom) the bottom nav
          // itself pads with, plus its own visible height - a plain bottom-14
          // sat right on top of (and got visually cut off by) the nav on
          // devices with a home-indicator safe area.
          style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
          className="btn-primary fixed inset-x-3 z-30 flex items-center justify-between gap-3 rounded-xl px-[22px] py-[15px] text-left shadow-lg sm:hidden"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-black/20 font-display text-sm">
              {selections.length}
            </span>
            <span className="font-display text-base">
              {selections.length === 1 ? 'Single' : 'Accumulator'}
            </span>
          </span>
          <span className="font-display text-base">
            {selections.length === 1 ? selections[0]?.odds.toFixed(2) : combinedOdds.toFixed(2)}
          </span>
        </button>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 px-1 py-1.5 backdrop-blur sm:hidden"
        style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
        aria-label="App navigation"
      >
        <button
          type="button"
          aria-pressed={isNavOpen}
          onClick={() => setIsNavOpen(true)}
          className={`flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isNavOpen ? 'text-highlight' : 'text-text-secondary'}`}
        >
          <SearchIcon width={19} height={19} />
          Search
        </button>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isActive ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <HomeIcon width={19} height={19} />
          Home
        </NavLink>
        <NavLink
          to="/live"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isActive ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <LiveIcon width={19} height={19} />
          Live
        </NavLink>
        <NavLink
          to="/my-bets"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isActive ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <MyBetsIcon width={19} height={19} />
          My Bets
        </NavLink>
        <NavLink
          to="/promotions"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isActive ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <PromotionsIcon width={19} height={19} />
          Promotions
        </NavLink>
      </nav>

      {/* Mobile-only: a bottom-sheet modal (same presentation as the
          register modal - see RegisterPage), not a full-height side drawer -
          sm:hidden keeps it from ever coexisting with the persistent desktop
          aside above. Taller than the register sheet since there's more to
          show (the selection list, stake fields, and the fixed footer). */}
      {isSlipOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:hidden">
          <button
            type="button"
            aria-label="Close bet slip"
            className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/80 backdrop-blur-sm"
            onClick={() => setIsSlipOpen(false)}
          />
          <div className="sheet-slide-up relative flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl border border-border bg-background">
            <div className="shrink-0 border-b border-border p-4 pb-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg">Bet Slip</h2>
                <button
                  type="button"
                  aria-label="Close bet slip"
                  className="text-text-muted hover:text-text-primary"
                  onClick={() => setIsSlipOpen(false)}
                >
                  ✕
                </button>
              </div>
              {/* Header's own balance display is sm:inline-only (hidden on
                  mobile), so this is the only place a mobile player can see
                  it - they need it right here to know how much they can
                  stake. */}
              {isAuthenticated && wallet && (
                <p className="mt-1 text-sm text-text-secondary">
                  Balance: <span className="font-semibold text-text-primary">€{formatCents(wallet.balanceCents)}</span>{' '}
                  (paper)
                </p>
              )}
            </div>
            <div className="min-h-0 flex-1 p-4 pt-3">
              <BetSlipPanel />
            </div>
          </div>
        </div>
      )}

      {/* Mobile-only: sports navigation takes over the full screen like its
          own page rather than a partial drawer with the rest of the app
          visible behind it - sm:hidden keeps it from ever coexisting with
          the persistent desktop aside above. */}
      {isNavOpen && (
        <div className="scrollbar-hide fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background p-4 sm:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Sports</h2>
            <button
              type="button"
              aria-label="Close sports navigation"
              className="text-text-muted hover:text-text-primary"
              onClick={() => setIsNavOpen(false)}
            >
              ✕
            </button>
          </div>
          <Sidebar onNavigate={() => setIsNavOpen(false)} stickyBgClassName="bg-background" />
        </div>
      )}
    </div>
  );
}

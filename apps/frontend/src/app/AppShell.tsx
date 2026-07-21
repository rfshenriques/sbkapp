import { Suspense, useEffect, useRef, useState, type TouchEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomSheet } from '../components/ui/BottomSheet';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { BetSlipPanel } from '../features/bet-slip/BetSlipPanel';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { useBrandTheme } from '../features/brand/useBrandTheme';
import { useAuth } from '../features/auth/useAuth';
import { useBootstrapAuth } from '../features/auth/useBootstrapAuth';
import { formatCents, useWallet } from '../features/wallet/useWallet';
import { Sidebar } from '../features/navigation/Sidebar';
import { HomeIcon, LiveIcon, MyBetsIcon, PromotionsIcon, SearchIcon } from '../components/ui/NavIcons';
import { useScrollLock } from '../lib/useScrollLock';

/** The 5 bottom-nav destinations in on-screen order, for swipe navigation. */
const NAV_STOPS: Array<{ kind: 'search' } | { kind: 'route'; path: string }> = [
  { kind: 'search' },
  { kind: 'route', path: '/' },
  { kind: 'route', path: '/live' },
  { kind: 'route', path: '/my-bets' },
  { kind: 'route', path: '/promotions' },
];

const SWIPE_THRESHOLD_PX = 60;

export function AppShell() {
  useBootstrapAuth();
  const brandQuery = useBrandTheme();
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const selections = useBetSlipStore((state) => state.selections);
  const { isAuthenticated, isInitialized, user, logout } = useAuth();
  const { data: wallet } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartRef = useRef<{ x: number; y: number; skip: boolean } | null>(null);

  const brandName = brandQuery.data?.name ?? 'Sportsbook';
  const combinedOdds = selections.reduce((total, selection) => total * selection.odds, 1);

  // Force the login sheet on the first load of a fresh session so promos
  // shown after login stay meaningful - only once per app open, and only
  // if the player hasn't already navigated straight to login/register.
  // Dismissible like any other bottom sheet: anonymous browsing is still
  // fully supported once closed.
  const hasForcedLoginRef = useRef(false);
  useEffect(() => {
    if (!isInitialized || hasForcedLoginRef.current) {
      return;
    }
    hasForcedLoginRef.current = true;
    if (!isAuthenticated && location.pathname !== '/login' && location.pathname !== '/register') {
      navigate('/login');
    }
  }, [isInitialized, isAuthenticated, location.pathname, navigate]);

  // Matches BottomSheet's own lock (see useScrollLock) - this drawer isn't
  // a BottomSheet, it's a bespoke overlay, so it needs the same treatment
  // itself: without it, the homepage underneath can still scroll (and on
  // iOS Safari, visibly detach the fixed-position drawer from the
  // viewport) while the drawer is open.
  useScrollLock(isNavOpen);

  // Swipe left/right between the 5 bottom-nav destinations, mobile only.
  // Swipes that start inside a horizontally-scrolling block (carousels,
  // the sport filter row, the breadcrumb trail) or inside a bottom-sheet
  // modal (login/register/bet slip) are ignored, so they keep their own
  // native/touch behavior instead of also paging the whole app.
  function handleTouchStart(event: TouchEvent) {
    if (window.innerWidth >= 640) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    if (!touch) {
      touchStartRef.current = null;
      return;
    }
    const target = event.target as HTMLElement;
    const skip = Boolean(target.closest('[data-horizontal-scroll], .sheet-slide-up'));
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, skip };
  }

  function handleTouchEnd(event: TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || start.skip || !touch) {
      return;
    }
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) {
      return;
    }
    const currentIndex = isNavOpen
      ? 0
      : NAV_STOPS.findIndex((stop) => stop.kind === 'route' && stop.path === location.pathname);
    if (currentIndex === -1) {
      return;
    }
    const nextIndex = currentIndex + (deltaX < 0 ? 1 : -1);
    const next = NAV_STOPS[nextIndex];
    if (!next) {
      return;
    }
    if (next.kind === 'search') {
      setIsNavOpen(true);
    } else {
      setIsNavOpen(false);
      navigate(next.path);
    }
  }

  return (
    <div
      className="min-h-screen pb-20 sm:pb-0"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <header className="app-header sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
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
          <div className="scrollbar-hide sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-4">
            <Sidebar />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Suspense fallback={<PageSkeleton />}>
            <div key={location.pathname} className="fade-in-up">
              <Outlet />
            </div>
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
          <div className="sticky top-20 flex h-[calc(100vh-6rem)] flex-col rounded-2xl border border-border bg-surface p-4">
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
          className="btn-primary cta-spring-in fixed inset-x-3 z-30 flex items-center justify-between gap-3 rounded-2xl px-[22px] py-[15px] text-left shadow-lg sm:hidden"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-black/20 font-display text-sm">
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
          onClick={() => setIsNavOpen((open) => !open)}
          className={`flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isNavOpen ? 'text-highlight' : 'text-text-secondary'}`}
        >
          <SearchIcon width={19} height={19} />
          Search
        </button>
        <NavLink
          to="/"
          end
          onClick={() => setIsNavOpen(false)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isActive && !isNavOpen ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <HomeIcon width={19} height={19} />
          Home
        </NavLink>
        <NavLink
          to="/live"
          onClick={() => setIsNavOpen(false)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isActive && !isNavOpen ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <LiveIcon width={19} height={19} />
          Live
        </NavLink>
        <NavLink
          to="/my-bets"
          onClick={() => setIsNavOpen(false)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isActive && !isNavOpen ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <MyBetsIcon width={19} height={19} />
          My Bets
        </NavLink>
        <NavLink
          to="/promotions"
          onClick={() => setIsNavOpen(false)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isActive && !isNavOpen ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <PromotionsIcon width={19} height={19} />
          Promotions
        </NavLink>
      </nav>

      {/* Mobile-only: the same bottom-sheet presentation as login/register
          (see BottomSheet) rather than a full-height side drawer - sm:hidden
          keeps it from ever coexisting with the persistent desktop aside
          above. bodyClassName is overridden to plain padding (no scroll of
          its own) since BetSlipPanel already manages its own scrollable
          region and fixed footer internally. */}
      {isSlipOpen && (
        <div className="sm:hidden">
          <BottomSheet
            title="Bet Slip"
            onClose={() => setIsSlipOpen(false)}
            closeLabel="Close bet slip"
            bodyClassName="min-h-0 flex-1 p-4"
            headerExtra={
              // Header's own balance display is sm:inline-only (hidden on
              // mobile), so this is the only place a mobile player can see
              // it - they need it right here to know how much they can stake.
              isAuthenticated && wallet ? (
                <p className="mt-1 text-sm text-text-secondary">
                  Balance:{' '}
                  <span className="font-semibold text-text-primary">€{formatCents(wallet.balanceCents)}</span> (paper)
                </p>
              ) : undefined
            }
          >
            <BetSlipPanel />
          </BottomSheet>
        </div>
      )}

      {/* Mobile-only: sports navigation takes over the space between the
          header and bottom nav like its own page, rather than a partial
          drawer with the rest of the app visible behind it - sm:hidden
          keeps it from ever coexisting with the persistent desktop aside
          above. Bounded to top-16/bottom (not inset-0) so the header and
          bottom nav stay visible and on top, the same as every other page -
          a plain inset-0 used to cover both entirely, making this feel like
          it had left the app rather than being part of it. No explicit
          close button - tapping Search again or any other bottom-nav tab
          closes it, same as switching between any other pair of pages. */}
      {isNavOpen && (
        <div
          className="fade-in-down scrollbar-hide fixed inset-x-0 top-16 z-20 flex flex-col overflow-y-auto bg-background p-4 sm:hidden"
          style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
        >
          <h2 className="mb-3 font-display text-lg">Sports</h2>
          <Sidebar onNavigate={() => setIsNavOpen(false)} stickyBgClassName="bg-background" />
        </div>
      )}
    </div>
  );
}

import { Suspense, useEffect, useRef, useState, type TouchEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomSheet } from '../components/ui/BottomSheet';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { BetSlipPanel } from '../features/bet-slip/BetSlipPanel';
import { BetPlacedModal } from '../features/bet-slip/BetPlacedModal';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { invalidAccumulatorReason } from '../features/bet-slip/accumulatorValidity';
import { BetDetailModal } from '../features/bet-history/BetDetailModal';
import { useWinCelebrationDetector } from '../features/bet-history/useWinCelebrationDetector';
import { WinCelebrationModal } from '../features/bet-history/WinCelebrationModal';
import { useBrandTheme } from '../features/brand/useBrandTheme';
import { Footer } from '../features/footer/Footer';
import { AccountMenu } from '../features/auth/AccountMenu';
import { PasskeyEnrollmentModal } from '../features/auth/PasskeyEnrollmentModal';
import { useAuth } from '../features/auth/useAuth';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { useBootstrapAuth } from '../features/auth/useBootstrapAuth';
import { attemptBiometricLogin } from '../lib/webauthn';
import { DepositCampaignModal } from '../features/deposit-campaigns/DepositCampaignModal';
import { DepositModal } from '../features/deposit/DepositModal';
import { useDepositModalStore } from '../features/deposit/depositModalStore';
import { BalancePills } from '../features/wallet/BalancePills';
import { InsufficientFundsModal } from '../features/wallet/InsufficientFundsModal';
import { useWallet } from '../features/wallet/useWallet';
import { sumFreebetsCents, useFreebets } from '../features/wallet/useFreebets';
import { Sidebar } from '../features/navigation/Sidebar';
import { FireIcon, LiveIcon, MyBetsIcon, SearchIcon, TrophyIcon } from '../components/ui/NavIcons';
import { useScrollLock } from '../lib/useScrollLock';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';

/** The 5 bottom-nav destinations in on-screen order, for swipe navigation. */
const NAV_STOPS: Array<{ kind: 'search' } | { kind: 'route'; path: string }> = [
  { kind: 'search' },
  { kind: 'route', path: '/' },
  { kind: 'route', path: '/live' },
  { kind: 'route', path: '/my-bets' },
  { kind: 'route', path: '/challenges' },
];

const SWIPE_THRESHOLD_PX = 60;

export function AppShell() {
  useBootstrapAuth();
  useWinCelebrationDetector();
  const brandQuery = useBrandTheme();
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const selections = useBetSlipStore((state) => state.selections);
  const { isAuthenticated, isInitialized } = useAuth();
  const authModalMode = useAuthModalStore((state) => state.mode);
  const openAuthModal = useAuthModalStore((state) => state.open);
  const { data: wallet } = useWallet();
  const { data: freebets } = useFreebets();
  const freebetsCents = sumFreebetsCents(freebets);
  const openDepositModal = useDepositModalStore((state) => state.open);
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartRef = useRef<{ x: number; y: number; skip: boolean } | null>(null);

  const brandName = brandQuery.data?.name ?? 'Sportsbook';
  const combinedOdds = selections.reduce((total, selection) => total * selection.odds, 1);
  // Mirrors BetSlipPanel's own accumulatorInvalidReason gate - the unopened
  // floating pill is the player's first look at what's in the slip, so it
  // shouldn't advertise a combined price (or the Accumulator label) for a
  // combination the bet slip itself would immediately reject.
  const accumulatorInvalidReason = selections.length > 1 ? invalidAccumulatorReason(selections) : null;

  // Force the login sheet on the first load of a fresh session so promos
  // shown after login stay meaningful - only once per app open. Opens as a
  // modal over whatever page is current (see authModalStore) rather than
  // navigating to a separate /login route, so the page underneath stays
  // mounted and visible instead of leaving an empty page behind the sheet.
  // Dismissible like any other bottom sheet: anonymous browsing is still
  // fully supported once closed. First tries a silent biometric/passkey
  // login (see lib/webauthn.ts) - the password form only opens once that
  // fails, isn't available on this device, or the player cancels it.
  const hasForcedLoginRef = useRef(false);
  useEffect(() => {
    if (!isInitialized || hasForcedLoginRef.current) {
      return;
    }
    hasForcedLoginRef.current = true;
    // A deep-linked /login or /register (see AuthDeepLink.tsx) already
    // opened a mode by the time this runs - child effects fire before the
    // parent's on mount - so don't clobber a deliberate Register deep link
    // back to Login.
    if (!isAuthenticated && useAuthModalStore.getState().mode === null) {
      void attemptBiometricLogin().then((loggedIn) => {
        if (!loggedIn && useAuthModalStore.getState().mode === null) {
          openAuthModal('login');
        }
      });
    }
  }, [isInitialized, isAuthenticated, openAuthModal]);

  // Matches BottomSheet's own lock (see useScrollLock) - this drawer isn't
  // a BottomSheet, it's a bespoke overlay, so it needs the same treatment
  // itself: without it, the homepage underneath can still scroll (and on
  // iOS Safari, visibly detach the fixed-position drawer from the
  // viewport) while the drawer is open.
  useScrollLock(isNavOpen);

  // <body> - not <html>/window - is the actual scroll container (the
  // page-wide overflow-x: hidden rule on body promotes its overflow-y to
  // auto per spec) and it never unmounts between routes, so both its
  // scroll offsets survive a navigation instead of resetting like a fresh
  // page load would. Horizontally that shows up as a carousel's snapped
  // offset leaking into whatever page loads next (see the Featured/Promo
  // card pair); vertically it shows up as e.g. opening a match from partway
  // down the homepage landing on the match page already scrolled past its
  // own sticky header. Nothing in the app ever wants either carried across
  // a route change, so force both back to 0 on every one.
  useEffect(() => {
    document.body.scrollLeft = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [location.pathname]);

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
        <div className="mx-auto grid max-w-[1680px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3">
          <NavLink to="/" className="flex shrink-0 items-center gap-2">
            {brandQuery.data?.logoUrl ? (
              <img src={brandQuery.data.logoUrl} alt={brandName} className="h-8 max-w-[10rem] object-contain" />
            ) : (
              <span className="font-display text-xl">{brandName}</span>
            )}
          </NavLink>

          {/* Desktop only - mirrors the mobile bottom nav's destinations
              (minus Search, which desktop already has via the persistent
              Sidebar's own search bar) so the same pages are reachable
              without needing the bottom nav's icon strip. Centered in the
              header's remaining space between the logo and the auth
              buttons via the grid's middle 1fr column, not just packed
              next to the logo. */}
          <nav aria-label="Desktop app navigation" className="hidden items-center justify-center gap-5 sm:flex">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 text-sm font-semibold ${isActive ? 'text-highlight' : 'text-text-secondary hover:text-text-primary'}`
              }
            >
              <FireIcon width={16} height={16} />
              Highlights
            </NavLink>
            <NavLink
              to="/live"
              className={({ isActive }) =>
                `flex items-center gap-1.5 text-sm font-semibold ${isActive ? 'text-highlight' : 'text-text-secondary hover:text-text-primary'}`
              }
            >
              <LiveIcon width={16} height={16} />
              Live
            </NavLink>
            <NavLink
              to="/my-bets"
              className={({ isActive }) =>
                `flex items-center gap-1.5 text-sm font-semibold ${isActive ? 'text-highlight' : 'text-text-secondary hover:text-text-primary'}`
              }
            >
              <MyBetsIcon width={16} height={16} />
              My Bets
            </NavLink>
            <NavLink
              to="/challenges"
              className={({ isActive }) =>
                `flex items-center gap-1.5 text-sm font-semibold ${isActive ? 'text-highlight' : 'text-text-secondary hover:text-text-primary'}`
              }
            >
              <TrophyIcon width={16} height={16} />
              Challenges
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {isInitialized && isAuthenticated ? (
              <>
                {wallet && (
                  <BalancePills
                    cashCents={wallet.balanceCents}
                    freebetsCents={freebetsCents}
                    onAddFunds={openDepositModal}
                  />
                )}
                <AccountMenu />
              </>
            ) : (
              isInitialized && (
                <>
                  <button type="button" onClick={() => openAuthModal('login')} className="btn-ghost">
                    Log in
                  </button>
                  <button type="button" onClick={() => openAuthModal('register')} className="btn-primary">
                    Register
                  </button>
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
          <div className="scrollbar-hide sticky top-16 max-h-[calc(100vh-4.5rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-4">
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
          <div className="sticky top-16 flex h-[calc(100vh-4.5rem)] flex-col rounded-2xl border border-border bg-surface p-4">
            <BetSlipPanel showHistoryTab emptyStateVariant="promotional" />
          </div>
        </aside>
      </div>

      <Footer />

      {/* Hidden while the sports nav drawer is open - it's z-30 (above the
          drawer's z-20, so the bottom nav stays reachable above it) and was
          poking a rounded corner up over the drawer's own bottom edge. */}
      {selections.length > 0 && !isNavOpen && (
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
              {selections.length === 1 ? 'Single' : accumulatorInvalidReason ? 'Singles' : 'Accumulator'}
            </span>
          </span>
          <span className="font-display text-base">
            {selections.length === 1
              ? selections[0]?.odds.toFixed(2)
              : accumulatorInvalidReason
                ? '/'
                : combinedOdds.toFixed(2)}
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
          <FireIcon width={19} height={19} />
          Highlights
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
          to="/challenges"
          onClick={() => setIsNavOpen(false)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${isActive && !isNavOpen ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <TrophyIcon width={19} height={19} />
          Challenges
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
            // Taller than the default 80dvh - stake-limit alerts, acca
            // boost/rollback bars and the insurance toggle stack up under
            // the selections and otherwise leave very little of the actual
            // selection list visible before the fixed footer starts.
            mobileHeightClassName="h-[92dvh]"
          >
            <BetSlipPanel />
          </BottomSheet>
        </div>
      )}

      {/* Rendered as an overlay alongside the Outlet, not as a route the
          Outlet swaps to - keeps whatever page the player was on mounted
          and visible (dimmed) behind the modal instead of unmounting it
          into an empty page. Desktop-vs-mobile presentation (centered
          dialog vs bottom sheet) is handled inside BottomSheet itself, same
          as every other modal. */}
      {authModalMode === 'login' && <LoginPage />}
      {authModalMode === 'register' && <RegisterPage />}
      <DepositCampaignModal />
      <DepositModal />
      <InsufficientFundsModal />
      <PasskeyEnrollmentModal />
      <BetDetailModal />
      <WinCelebrationModal />
      <BetPlacedModal />

      {/* Mobile-only: sports navigation takes over the space between the
          header and bottom nav like its own page, rather than a partial
          drawer with the rest of the app visible behind it - sm:hidden
          keeps it from ever coexisting with the persistent desktop aside
          above. Bottom is bounded (not inset-0) so the bottom nav stays
          visible and on top - a plain inset-0 used to cover it entirely,
          making this feel like it had left the app rather than being part
          of it. No explicit close button - tapping Search again or any
          other bottom-nav tab closes it, same as switching between any
          other pair of pages.

          Extends up to top-0, behind the header (header is z-30, this is
          z-20, so it still renders on top) rather than starting at top-16 -
          the header's bg-background/90 + backdrop-blur is only ~90% opaque
          by design (it's meant to blur the page scrolling underneath it),
          so stopping the drawer right at the header's bottom edge left the
          still-mounted page behind it (not this drawer) showing dimly
          blurred through that translucent strip. Extra pt-20 keeps the
          drawer's own content starting below the header as before. */}
      {isNavOpen && (
        <div
          className="slide-in-down scrollbar-hide fixed inset-x-0 top-0 z-20 flex flex-col overflow-y-auto bg-background p-4 pt-20 sm:hidden"
          style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
        >
          <h2 className="mb-3 font-display text-lg">Sports</h2>
          <Sidebar onNavigate={() => setIsNavOpen(false)} stickyBgClassName="bg-background" />
        </div>
      )}
    </div>
  );
}

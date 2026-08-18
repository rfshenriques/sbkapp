import { Suspense, useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppBootScreen } from '../components/ui/AppBootScreen';
import { BottomSheet } from '../components/ui/BottomSheet';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { BetSlipPanel } from '../features/bet-slip/BetSlipPanel';
import { BetPlacedModal } from '../features/bet-slip/BetPlacedModal';
import { useBetPlacedModalStore } from '../features/bet-slip/betPlacedModalStore';
import { useBetSlipSheetStore } from '../features/bet-slip/betSlipSheetStore';
import { getSingleStake, useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { TabletBetSlipDrawer } from '../features/bet-slip/TabletBetSlipDrawer';
import { useCampaignPreview } from '../features/bet-slip/useCampaignPreview';
import { LiveMatchesStrip } from '../features/odds-board/LiveMatchesStrip';
import { invalidAccumulatorReason } from '../features/bet-slip/accumulatorValidity';
import { useWinCelebrationDetector } from '../features/bet-history/useWinCelebrationDetector';
import { WinCelebrationModal } from '../features/bet-history/WinCelebrationModal';
import { useBrandTheme } from '../features/brand/useBrandTheme';
import { useBrandStore } from '../features/brand/brandStore';
import { useAnalyticsPageViews } from '../features/analytics/useAnalyticsPageViews';
import { Footer } from '../features/footer/Footer';
import { AccountMenu } from '../features/auth/AccountMenu';
import { ForceLogoutModal } from '../features/auth/ForceLogoutModal';
import { PasskeyEnrollmentModal } from '../features/auth/PasskeyEnrollmentModal';
import { useAuth } from '../features/auth/useAuth';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { useBootstrapAuth } from '../features/auth/useBootstrapAuth';
import { useForceLogout } from '../features/auth/useForceLogout';
import { attemptBiometricLogin } from '../lib/webauthn';
import { recordForcedLoginPromptShown, shouldShowForcedLoginPrompt } from '../lib/forcedLoginPrompt';
import { DepositCampaignModal } from '../features/deposit-campaigns/DepositCampaignModal';
import { useEligibleDepositCampaign } from '../features/deposit-campaigns/useEligibleDepositCampaign';
import { DepositModal } from '../features/deposit/DepositModal';
import { useDepositModalStore } from '../features/deposit/depositModalStore';
import { BalancePills } from '../features/wallet/BalancePills';
import { InsufficientFundsModal } from '../features/wallet/InsufficientFundsModal';
import { HEADER_FREEBETS_BALANCE_ID } from '../features/wallet/balanceTargetIds';
import { FreebetCreditedModal } from '../features/wallet/FreebetCreditedModal';
import { FreebetFlyOverlay } from '../features/wallet/FreebetFlyOverlay';
import { useFreebetGrantDetector } from '../features/wallet/useFreebetGrantDetector';
import { useWallet } from '../features/wallet/useWallet';
import { sumFreebetsCents, useFreebets } from '../features/wallet/useFreebets';
import { SecondaryNavBar } from '../features/navigation/SecondaryNavBar';
import { Sidebar } from '../features/navigation/Sidebar';
import { FireIcon, GiftBadgeIcon, LiveIcon, MyBetsIcon, SearchIcon, TrophyIcon } from '../components/ui/NavIcons';
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
  useForceLogout();
  useAnalyticsPageViews();
  useWinCelebrationDetector();
  useFreebetGrantDetector();
  const brandQuery = useBrandTheme();
  const brandLogoUrl = useBrandStore((state) => state.logoUrl);
  const isSlipOpen = useBetSlipSheetStore((state) => state.isOpen);
  const openSlip = useBetSlipSheetStore((state) => state.open);
  const closeSlip = useBetSlipSheetStore((state) => state.close);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const betPlacedSummary = useBetPlacedModalStore((state) => state.summary);
  // Placing a bet opens BetPlacedModal on top of everything else - the
  // mobile bet slip bottom sheet needs to close itself first, otherwise the
  // confirmation stacks on top of it instead of replacing it.
  useEffect(() => {
    if (betPlacedSummary) {
      closeSlip();
    }
  }, [betPlacedSummary]);
  const selections = useBetSlipStore((state) => state.selections);
  // Closes the mobile sheet / tablet drawer automatically once the last
  // selection is removed - an open bet slip with nothing left in it just
  // sits there uselessly otherwise. Desktop's persistent panel is
  // unaffected (it's not gated by isSlipOpen at all).
  useEffect(() => {
    if (selections.length === 0) {
      closeSlip();
    }
  }, [selections.length]);
  const stake = useBetSlipStore((state) => state.stake);
  const singleStakes = useBetSlipStore((state) => state.singleStakes);
  const { isAuthenticated, isInitialized } = useAuth();
  const authModalMode = useAuthModalStore((state) => state.mode);
  const openAuthModal = useAuthModalStore((state) => state.open);
  const { data: wallet } = useWallet();
  const { data: freebets } = useFreebets();
  const freebetsCents = sumFreebetsCents(freebets);
  const openDepositModal = useDepositModalStore((state) => state.open);
  const { data: eligibleDepositCampaign } = useEligibleDepositCampaign();
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartRef = useRef<{ x: number; y: number; skip: boolean } | null>(null);

  // The header is position:fixed (see below) so it never scrolls away, even
  // mid-momentum-scroll on iOS - unlike position:sticky it can't ever detach
  // from the top edge. Fixed removes it from normal document flow though, so
  // a spacer of the same height has to hold its place, otherwise page
  // content would render underneath it. Measured via ResizeObserver rather
  // than a hardcoded height - the header's own content (brand logo vs text,
  // wallet balance pills, auth buttons) can change without warning.
  //
  // A callback ref (not useRef+a []-effect) is deliberate: this component
  // returns AppBootScreen instead of the real header on every render before
  // brandQuery resolves (see the isPending check below), so the header DOM
  // node doesn't exist yet the first time a plain useEffect(fn, []) would
  // run - it'd read a null ref forever and never retry once the real header
  // finally mounts. A callback ref fires exactly when the node is actually
  // attached, however many renders that takes, so the observer always ends
  // up watching the real element.
  const [headerNode, setHeaderNode] = useState<HTMLElement | null>(null);
  const headerRef = useCallback((node: HTMLElement | null) => setHeaderNode(node), []);
  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    if (!headerNode) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeaderHeight(entry.contentRect.height);
    });
    observer.observe(headerNode);
    return () => observer.disconnect();
  }, [headerNode]);

  // Same measured-not-hardcoded reasoning as headerHeight above, for the
  // fixed bottom nav - the floating bet-slip pill and the mobile drawer
  // both need to clear its real height (padding included) rather than
  // guessing a fixed 4.25rem, which drifts the moment the nav's own
  // padding or safe-area inset differs from that guess. getBoundingClientRect
  // (not entry.contentRect) is used deliberately - contentRect excludes the
  // nav's own padding, which is exactly where the safe-area-inset-bottom
  // padding this height needs to account for actually lives. Callback ref
  // for the same late-mount reason as headerNode above - the bottom nav is
  // behind the same AppBootScreen early return.
  const [bottomNavNode, setBottomNavNode] = useState<HTMLElement | null>(null);
  const bottomNavRef = useCallback((node: HTMLElement | null) => setBottomNavNode(node), []);
  const [bottomNavHeight, setBottomNavHeight] = useState(68);
  useEffect(() => {
    if (!bottomNavNode) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBottomNavHeight(entry.target.getBoundingClientRect().height);
    });
    observer.observe(bottomNavNode);
    return () => observer.disconnect();
  }, [bottomNavNode]);

  const brandName = brandQuery.data?.name ?? 'Sportsbook';
  const combinedOdds = selections.reduce((total, selection) => total * selection.odds, 1);
  // Mirrors BetSlipPanel's own accumulatorInvalidReason gate - the unopened
  // floating pill is the player's first look at what's in the slip, so it
  // shouldn't advertise a combined price (or the Accumulator label) for a
  // combination the bet slip itself would immediately reject.
  const accumulatorInvalidReason = selections.length > 1 ? invalidAccumulatorReason(selections) : null;

  // Same qualifying-bet shape the bet slip itself previews (see
  // BetSlipPanel's accumulatorCampaignPreview/singleSelectionCampaignPreview)
  // - single selection uses its own stake, an uncombinable multi-selection
  // slip previews nothing (there's no one combined bet to qualify), and a
  // valid 2+ accumulator uses the shared accumulator stake. Doesn't account
  // for insurance/freebet mode (both reset to off on their own toggles and
  // aren't tracked in the shared store), so this can very rarely show the
  // badge for a moment the panel itself wouldn't - acceptable since opening
  // the slip always shows the authoritative, fully-accurate note.
  const pillPreviewSelections =
    selections.length === 1 ? selections : accumulatorInvalidReason ? [] : selections;
  const pillPreviewStakeCents =
    selections.length === 1
      ? Math.round(Number(getSingleStake(singleStakes, selections[0]!)) * 100)
      : Math.round(Number(stake) * 100);
  const pillCampaignPreview = useCampaignPreview(pillPreviewSelections, pillPreviewStakeCents);
  const hasQualifyingCampaign = Boolean(
    pillCampaignPreview?.betAndGetCampaignName || pillCampaignPreview?.depositCampaignName,
  );

  // Force the login sheet so promos shown after login stay meaningful - but
  // at most once an hour per device (see forcedLoginPrompt.ts), not on
  // every single page load. A plain in-memory ref only guards against
  // firing twice within one already-mounted tab; the hour-long throttle
  // itself is persisted in localStorage so it survives a refresh, which
  // remounts this whole component and would otherwise reset an in-memory
  // guard right back to "never shown". Opens as a modal over whatever page
  // is current (see authModalStore) rather than navigating to a separate
  // /login route, so the page underneath stays mounted and visible instead
  // of leaving an empty page behind the sheet. Dismissible like any other
  // bottom sheet: anonymous browsing is still fully supported once closed.
  // First tries a silent biometric/passkey login (see lib/webauthn.ts) -
  // the password form only opens once that fails, isn't available on this
  // device, or the player cancels it.
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
    if (!isAuthenticated && useAuthModalStore.getState().mode === null && shouldShowForcedLoginPrompt()) {
      recordForcedLoginPromptShown();
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

  // html - not body (see its overflow-x comment in index.css) - is the
  // real scroll container, and it never unmounts between routes, so its
  // scroll position survives a navigation instead of resetting like a
  // fresh page load would. Horizontally that shows up as a carousel's
  // snapped offset leaking into whatever page loads next (see the
  // Featured/Promo card pair); vertically it shows up as e.g. opening a
  // match from partway down the homepage landing on the match page
  // already scrolled past its own sticky header. Nothing in the app ever
  // wants either carried across a route change, so force it back to 0 on
  // every one.
  useEffect(() => {
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

  // Renders the neutral boot spinner instead of the real header/nav until
  // the brand's fetch settles (success or failure) - without this gate the
  // first paint used the generic "Sportsbook" name and fallback colors,
  // then visibly snapped to the real brand a moment later.
  if (brandQuery.isPending) {
    return <AppBootScreen />;
  }

  return (
    <div
      className="flex min-h-screen flex-col pb-20 sm:pb-0"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Fully opaque, same --color-background as the rest of the page - a
          translucent/blurred header (the old bg-background/90 +
          backdrop-blur) reads as a different color once real page content
          scrolls underneath it, however subtly. No border-b either - a
          dividing line would be its own second color breaking up header
          and page background, which is exactly what this is meant to
          avoid; a brand that wants separation can still get it by giving
          the header a distinct background color from master backoffice
          (see CLAUDE.md's design-system doc) once that's built, without
          this app hardcoding a line here. transform-gpu +
          will-change-transform stay as a plain fixed-position perf hint
          (iOS Safari can otherwise visually drift fixed elements with
          scrolled content), even though the backdrop-filter-specific
          interaction that originally motivated them no longer applies. */}
      <header
        ref={headerRef}
        className="app-header fixed inset-x-0 top-0 z-30 transform-gpu bg-background will-change-transform"
      >
        <div
          className="mx-auto grid max-w-[1680px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <NavLink to="/" className="col-start-1 flex shrink-0 items-center gap-2">
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt={brandName} className="h-8 max-w-[10rem] object-contain" />
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
              next to the logo. Explicit col-start (not just DOM order) -
              this element is display:none below sm, and CSS Grid
              auto-placement drops a display:none item from the grid
              entirely rather than leaving its track empty, which would
              shift the right-hand group below into this middle track
              instead of its own - see the right-hand group's own
              col-start-3 for the other half of this fix. */}
          <nav aria-label="Desktop app navigation" className="col-start-2 hidden items-center justify-center gap-5 sm:flex">
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

          {/* col-start-3, not just ml-auto - pinned to the grid's own last
              track so this group stays flush right at every viewport
              regardless of whether the middle nav column has any content
              (see its own comment above); ml-auto is still kept as a
              defensive fallback within that track. */}
          <div className="col-start-3 ml-auto flex items-center gap-2">
            {isInitialized && isAuthenticated ? (
              <>
                {wallet && (
                  <BalancePills
                    cashCents={wallet.balanceCents}
                    freebetsCents={freebetsCents}
                    onAddFunds={openDepositModal}
                    freebetsTargetId={HEADER_FREEBETS_BALANCE_ID}
                    hasEligibleDepositCampaign={Boolean(eligibleDepositCampaign)}
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
        {/* Constrained to the center content column on desktop, not the
            header's full width - offsets mirror the row below's own p-4
            edge padding plus the sidebar's width+gap (1rem + sm:w-96 +
            gap-4) on the left and the bet slip column's (1rem + lg:w-80 +
            gap-4) on the right, at the same breakpoints those columns
            themselves appear at, so this bar lines up with <main> exactly
            rather than sitting flush against the header's own edges. Below
            sm: (no sidebar/bet-slip columns at all) it stays full width via
            the base px-4. */}
        <div className="mx-auto max-w-[1680px] px-4 sm:pl-[26rem] lg:pr-[22rem]">
          <SecondaryNavBar />
        </div>
      </header>
      <div style={{ height: headerHeight }} aria-hidden="true" />

      {/* flex-1 so this row (not the page itself) absorbs any leftover
          vertical space - without it, a short page's content ends and
          Footer immediately follows partway up the viewport instead of
          being pinned to its bottom edge. On a page whose content is
          already taller than the viewport this is a no-op: flex-1 can't
          shrink content below its own height, so Footer just lands at the
          true end of content as before. */}
      <div className="mx-auto flex w-full max-w-[1680px] flex-1 gap-4 p-4">
        {/* Desktop: sports navigation is a persistent left column, same
            convention as the bet slip's persistent right column - the
            mobile drawer below is sm:hidden so the two never coexist.
            Deliberately wider than the bet slip column (sm:w-80 below):
            the sport/country/competition tree and Top Competitions list
            need more room to stay readable than the compact bet slip does. */}
        <aside className="hidden sm:block sm:w-96 sm:shrink-0">
          {/* h-full (not just max-h) so this stretches to match the row's
              tallest column (usually main) instead of collapsing to its own
              content height - without it, a short main content area (or a
              short sports tree) left this looking like a stubby box with
              dead page background beneath it rather than a full column.
              min-h-0 stops the flex item's default content-based min-height
              from fighting the max-h cap, which would otherwise force the
              whole row (and page) taller than the viewport again - the
              exact bug the max-h switch above already fixed once. */}
          <div
            className="scrollbar-hide sticky h-full min-h-0 overflow-y-auto rounded-2xl border border-border bg-surface p-4"
            style={{ top: headerHeight, maxHeight: `calc(100vh - ${headerHeight}px)` }}
          >
            <Sidebar />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <LiveMatchesStrip />
          <Suspense fallback={<PageSkeleton />}>
            <div key={location.pathname} className="fade-in-up">
              <Outlet />
            </div>
          </Suspense>
        </main>

        {/* Full desktop only (lg:+) - the bet slip is always visible on the
            right, not a click-to-open drawer. At sm:-to-lg: (tablet) widths
            there isn't room for nav + content + this column all at once, so
            it's hidden here and opened on demand as a floating right-edge
            panel instead (see TabletBetSlipDrawer below); below sm: it's
            the mobile bottom sheet. Exactly one of the three ever renders
            for a given viewport width. h-full + max-h (not a fixed h-) so
            BetSlipPanel's "promotional" empty state - which is built as a
            full-height, CTA-driven layout (see its own h-full min-h-0 root,
            BetSlipPanel.tsx) - actually gets a parent with a definite height
            to fill and center within, capped at the viewport so a very tall
            column can't push the whole page (and Footer) past the fold the
            way a fixed height here used to. BetSlipPanel owns its own
            scroll region and keeps the stake/payout calculator fixed at the
            bottom - this wrapper just gives it a bounded height to work
            within, no overflow of its own. */}
        <aside className="hidden lg:block lg:w-80 lg:shrink-0">
          <div
            className="sticky flex h-full min-h-0 flex-col rounded-2xl border border-border bg-surface p-4"
            style={{ top: headerHeight, maxHeight: `calc(100vh - ${headerHeight}px)` }}
          >
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
          onClick={openSlip}
          // Cleared by the bottom nav's own measured height (bottomNavHeight
          // above), not a hardcoded guess - a plain bottom-14 sat right on
          // top of (and got visually cut off by) the nav on devices with a
          // home-indicator safe area, and a fixed rem value drifts the
          // moment the nav's real height doesn't match it.
          style={{ bottom: bottomNavHeight }}
          className="btn-primary cta-spring-in fixed inset-x-3 z-30 flex items-center justify-between gap-2.5 rounded-2xl px-4 py-3 text-left shadow-lg sm:hidden"
        >
          {hasQualifyingCampaign && (
            <span
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background"
              title="This bet qualifies for a campaign reward"
            >
              <GiftBadgeIcon width={20} height={20} />
            </span>
          )}
          <span className="flex items-center gap-2.5">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-lg bg-black/20 font-display text-xs">
              {selections.length}
            </span>
            <span className="font-display text-sm">
              {selections.length === 1 ? 'Single' : accumulatorInvalidReason ? 'Singles' : 'Accumulator'}
            </span>
          </span>
          <span className="font-display text-sm">
            {selections.length === 1
              ? selections[0]?.odds.toFixed(2)
              : accumulatorInvalidReason
                ? '/'
                : combinedOdds.toFixed(2)}
          </span>
        </button>
      )}

      {/* Tablet only (sm:-to-lg:, see the persistent bet-slip aside above) -
          there's no bottom nav at these widths to anchor above (that's
          mobile-only, sm:hidden below), so this floats free in the corner
          instead of spanning the width like the mobile pill above. */}
      {selections.length > 0 && (
        <button
          type="button"
          onClick={openSlip}
          aria-label="Open bet slip"
          className="btn-primary cta-spring-in fixed right-4 bottom-4 z-30 hidden items-center gap-2 rounded-full px-4 py-3 text-left shadow-lg sm:flex lg:hidden"
        >
          {hasQualifyingCampaign && (
            <span
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background"
              title="This bet qualifies for a campaign reward"
            >
              <GiftBadgeIcon width={20} height={20} />
            </span>
          )}
          <span className="flex h-5 min-w-5 items-center justify-center rounded-lg bg-black/20 font-display text-xs">
            {selections.length}
          </span>
          <span className="font-display text-sm">Bet Slip</span>
        </button>
      )}

      {/* Same GPU-layer fix as the header above - the fixed bottom nav shares
          the identical backdrop-blur + fixed-positioning combination. */}
      <nav
        ref={bottomNavRef}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 transform-gpu border-t border-border bg-background/95 px-1 py-1 backdrop-blur will-change-transform sm:hidden"
        style={{ paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom))' }}
        aria-label="App navigation"
      >
        <button
          type="button"
          aria-pressed={isNavOpen}
          onClick={() => setIsNavOpen((open) => !open)}
          className={`flex flex-col items-center gap-0.5 py-1 text-[10px] font-bold ${isNavOpen ? 'text-highlight' : 'text-text-secondary'}`}
        >
          <SearchIcon width={19} height={19} />
          Search
        </button>
        <NavLink
          to="/"
          end
          onClick={() => setIsNavOpen(false)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 text-[10px] font-bold ${isActive && !isNavOpen ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <FireIcon width={19} height={19} />
          Highlights
        </NavLink>
        <NavLink
          to="/live"
          onClick={() => setIsNavOpen(false)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 text-[10px] font-bold ${isActive && !isNavOpen ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <LiveIcon width={19} height={19} />
          Live
        </NavLink>
        <NavLink
          to="/my-bets"
          onClick={() => setIsNavOpen(false)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 text-[10px] font-bold ${isActive && !isNavOpen ? 'text-highlight' : 'text-text-secondary'}`
          }
        >
          <MyBetsIcon width={19} height={19} />
          My Bets
        </NavLink>
        <NavLink
          to="/challenges"
          onClick={() => setIsNavOpen(false)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 text-[10px] font-bold ${isActive && !isNavOpen ? 'text-highlight' : 'text-text-secondary'}`
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
            onClose={closeSlip}
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

      {/* Tablet-only (sm:-to-lg:) floating right-edge panel - see
          TabletBetSlipDrawer's own doc comment. The drawer's own root
          carries the `hidden sm:block lg:hidden` breakpoint gate, same
          convention as the mobile sheet's wrapper above. */}
      {isSlipOpen && <TabletBetSlipDrawer onClose={closeSlip} closeLabel="Close bet slip" />}

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
      <WinCelebrationModal />
      <FreebetCreditedModal />
      <FreebetFlyOverlay />
      <BetPlacedModal />
      <ForceLogoutModal />

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
          the header is fully opaque, but its own height still changes
          (a two-line brand name, wallet-balance pills once authenticated,
          ...) between renders, and starting this drawer at a fixed top-16
          would drift out of sync with the header's real bottom edge the
          moment that height changes, leaving a sliver of gap or overlap.
          Top padding uses the same measured headerHeight the main content spacer uses (not a fixed
          pt-20) - a hardcoded value drifts out of sync whenever the header's
          own height changes (a two-line brand name, wallet-balance pills
          once authenticated, ...), leaving this drawer's content starting
          under the header instead of below it. */}
      {isNavOpen && (
        <div
          className="slide-in-down scrollbar-hide fixed inset-x-0 top-0 z-20 flex flex-col overflow-y-auto bg-background p-4 pb-6 sm:hidden"
          style={{ paddingTop: headerHeight + 16, bottom: bottomNavHeight }}
        >
          <Sidebar onNavigate={() => setIsNavOpen(false)} stickyBgClassName="bg-background" />
        </div>
      )}
    </div>
  );
}

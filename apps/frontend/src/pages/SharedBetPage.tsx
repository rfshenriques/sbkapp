import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { getMatchById } from '../lib/backendApi';
import { useAuth } from '../features/auth/useAuth';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { useBrandStore } from '../features/brand/brandStore';
import { useBetSlipSheetStore } from '../features/bet-slip/betSlipSheetStore';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { decodeSharedBetSelections } from '../features/bet-slip/sharedBetLink';
import { useDisplayNames } from '../features/display-names/useDisplayNames';

/**
 * Landing page for a shared bet's deep link (see sharedBetLink.ts and
 * SharePendingBetActions) - re-resolves every selection against *today's*
 * live match data rather than trusting the link's own numbers, so a copied
 * bet always reflects the current market (price, whether the event/market
 * even still exists) instead of replaying a stale snapshot. A selection
 * whose match/market/selection can no longer be found (settled, removed,
 * feed gone) is silently skipped rather than added half-broken. Requires
 * login first, same as placing any bet - a deep link is just a faster way to
 * fill the slip, not a way around auth; the login sheet closes itself on
 * success same as everywhere else (see LoginPage), and this effect then
 * reacts to isAuthenticated flipping true to continue. Once resolved, opens
 * the bet slip sheet directly and returns home - the slip itself, now
 * showing what was just added, is the confirmation; no separate "N
 * selections added" screen to click through first.
 */
export default function SharedBetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isInitialized } = useAuth();
  const openAuthModal = useAuthModalStore((state) => state.open);
  const brandId = useBrandStore((state) => state.brandId);
  const addSelection = useBetSlipStore((state) => state.addSelection);
  const openSlip = useBetSlipSheetStore((state) => state.open);
  const displayName = useDisplayNames();
  const hasResolvedRef = useRef(false);
  const hasPromptedLoginRef = useRef(false);

  const refs = decodeSharedBetSelections(searchParams.get('sel') ?? '');

  useEffect(() => {
    if (!refs || !isInitialized) {
      return;
    }
    if (!isAuthenticated) {
      if (!hasPromptedLoginRef.current) {
        hasPromptedLoginRef.current = true;
        openAuthModal('login');
      }
      return;
    }
    if (hasResolvedRef.current || !brandId) {
      return;
    }
    hasResolvedRef.current = true;

    let cancelled = false;
    void (async () => {
      for (const ref of refs) {
        const match = await getMatchById(brandId, ref.matchId).catch(() => undefined);
        const market = match?.markets.find((candidate) => candidate.id === ref.marketId);
        const selection = market?.selections.find((candidate) => candidate.id === ref.selectionId);
        if (!match || !market || !selection) {
          continue;
        }
        addSelection({
          matchId: match.id,
          marketId: market.id,
          selectionId: selection.id,
          matchLabel: `${displayName('TEAM', match.homeTeam)} vs ${displayName('TEAM', match.awayTeam)}`,
          marketName: displayName('MARKET', market.name),
          selectionName: displayName('SELECTION', selection.name),
          odds: selection.odds,
          originalOdds: selection.originalOdds,
          maxStakeCents: selection.maxStakeCents ?? market.maxStakeCents,
          marketSinglesOnly: market.singlesOnly,
        });
      }
      if (!cancelled) {
        openSlip();
        navigate('/', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refs, isInitialized, isAuthenticated, brandId, addSelection, displayName, openAuthModal, openSlip, navigate]);

  if (!refs) {
    return (
      <EmptyState
        title="This bet link isn't valid"
        description="It may be incomplete or malformed."
        ctaLabel="Go to homepage"
        ctaHref="/"
      />
    );
  }

  if (!isInitialized) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Log in to add this bet"
        description="Log in to copy these selections into your own bet slip."
      />
    );
  }

  return <EmptyState title="Adding selections…" description="Fetching today's odds for this bet." />;
}

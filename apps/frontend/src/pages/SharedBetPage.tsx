import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { getMatchById } from '../lib/backendApi';
import { useAuth } from '../features/auth/useAuth';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { useBrandStore } from '../features/brand/brandStore';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { decodeSharedBetSelections } from '../features/bet-slip/sharedBetLink';
import { useDisplayNames } from '../features/display-names/useDisplayNames';

type Status = 'resolving' | 'done';

/**
 * Landing page for a shared bet's deep link (see sharedBetLink.ts and
 * SharePendingBetActions) - re-resolves every selection against *today's*
 * live match data rather than trusting the link's own numbers, so a copied
 * bet always reflects the current market (price, whether the event/market
 * even still exists) instead of replaying a stale snapshot. A selection
 * whose match/market/selection can no longer be found (settled, removed,
 * feed gone) is silently skipped rather than added half-broken. Requires
 * login first, same as placing any bet - a deep link is just a faster way to
 * fill the slip, not a way around auth. Stays mounted on this route through
 * the whole flow (unlike AuthDeepLink's immediate redirect) since it needs
 * to react to login completing before it can resolve anything.
 */
export default function SharedBetPage() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isInitialized } = useAuth();
  const openAuthModal = useAuthModalStore((state) => state.open);
  const brandId = useBrandStore((state) => state.brandId);
  const addSelection = useBetSlipStore((state) => state.addSelection);
  const displayName = useDisplayNames();
  const [status, setStatus] = useState<Status>('resolving');
  const [addedCount, setAddedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
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
      let added = 0;
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
        added += 1;
      }
      if (!cancelled) {
        setAddedCount(added);
        setTotalCount(refs.length);
        setStatus('done');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refs, isInitialized, isAuthenticated, brandId, addSelection, displayName, openAuthModal]);

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

  if (status === 'resolving') {
    return (
      <EmptyState title="Adding selections…" description="Fetching today's odds for this bet." />
    );
  }

  return (
    <EmptyState
      title={
        addedCount === totalCount
          ? `Added ${addedCount} selection${addedCount === 1 ? '' : 's'} to your bet slip`
          : `Added ${addedCount} of ${totalCount} selections`
      }
      description={
        addedCount < totalCount
          ? `${totalCount - addedCount} selection${totalCount - addedCount === 1 ? '' : 's'} couldn't be added - it may no longer be available.`
          : 'Open your bet slip to review and place it.'
      }
      ctaLabel="Continue"
      ctaHref="/"
    />
  );
}

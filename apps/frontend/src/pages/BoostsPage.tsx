import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { BoostedSelectionSummary } from '@sportsbook/shared';
import { BackButton } from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';
import { LockIcon } from '../components/ui/LockIcon';
import { SportCountryBadge } from '../components/ui/SportCountryBadge';
import { SportIcon } from '../components/ui/SportIcon';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { useMarketSuspensions } from '../features/bet-slip/useMarketSuspensions';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { useBoosts } from '../features/odds-board/useBoosts';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { formatKickoff } from '../lib/formatKickoff';

interface SportGroup {
  sport: string;
  items: BoostedSelectionSummary[];
}

function groupBySport(items: BoostedSelectionSummary[]): SportGroup[] {
  const groups = new Map<string, BoostedSelectionSummary[]>();
  for (const item of items) {
    const existing = groups.get(item.sport);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.sport, [item]);
    }
  }
  return Array.from(groups.entries()).map(([sport, sportItems]) => ({ sport, items: sportItems }));
}

function BoostedSelectionRow({ item }: { item: BoostedSelectionSummary }) {
  const displayName = useDisplayNames();
  const toggleSelection = useBetSlipStore((state) => state.toggleSelection);
  const selectedSelectionId = useBetSlipStore(
    (state) =>
      state.selections.find((selection) => selection.matchId === item.matchId && selection.marketId === item.marketId)
        ?.selectionId,
  );
  const { isSuspended, isCompetitionSuspended } = useMarketSuspensions();
  const suspended =
    isCompetitionSuspended(item.competition) || isSuspended(item.matchId, item.marketId, item.selectionId);
  const isSelected = selectedSelectionId === item.selectionId;

  const homeTeamLabel = displayName('TEAM', item.homeTeam);
  const awayTeamLabel = displayName('TEAM', item.awayTeam);
  const matchLabel = `${homeTeamLabel} vs ${awayTeamLabel}`;

  return (
    <Card className="bg-surface-2">
      <div className="mb-1 flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        <SportCountryBadge sport={item.sport} country={item.country} />
        <span className="min-w-0 flex-1 truncate">{displayName('COMPETITION', item.competition)}</span>
        <span className="ml-auto shrink-0 text-highlight">{formatKickoff(new Date(item.kickoff))}</span>
      </div>
      <Link to={`/matches/${item.matchId}`} className="mb-3 block font-semibold">
        {matchLabel}
      </Link>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-text-secondary">
            {displayName('MARKET', item.marketName)}: {displayName('SELECTION', item.selectionName)}
          </p>
          {item.maxStakeCents !== undefined && (
            <p className="text-[11px] text-text-secondary">
              Max stake for boosted price: €{(item.maxStakeCents / 100).toFixed(2)}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={suspended}
          aria-label={
            suspended
              ? `${item.selectionName} suspended`
              : `${item.selectionName} boosted to ${item.odds.toFixed(2)}, was ${item.previousOdds.toFixed(2)}${
                  item.maxStakeCents !== undefined
                    ? `, max stake €${(item.maxStakeCents / 100).toFixed(2)}`
                    : ''
                }`
          }
          className={`odd-btn shrink-0${isSelected ? ' selected' : ''}${suspended ? ' suspended' : ''}`}
          onClick={() =>
            toggleSelection({
              matchId: item.matchId,
              marketId: item.marketId,
              selectionId: item.selectionId,
              matchLabel,
              marketName: displayName('MARKET', item.marketName),
              selectionName: displayName('SELECTION', item.selectionName),
              odds: item.odds,
              originalOdds: item.previousOdds,
              maxStakeCents: item.maxStakeCents,
            })
          }
        >
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-highlight px-1.5 py-px text-[8px] font-extrabold tracking-wide text-black uppercase">
            Boost
          </span>
          {suspended ? (
            <LockIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <span className="flex flex-col items-center leading-none">
              <span className="text-[11px] text-text-secondary line-through decoration-1">
                {item.previousOdds.toFixed(2)}
              </span>
              <span className="odd-value text-highlight">{item.odds.toFixed(2)}</span>
            </span>
          )}
        </button>
      </div>
    </Card>
  );
}

/**
 * Every currently-active boost, grouped per sport - the player counterpart
 * to the backoffice's Boosts page. Flattened to one row per boosted
 * selection (see BoostedSelectionSummary/PublicBoostsController) so a
 * player can see and bet the boosted price without drilling into the match
 * first, same as tapping an odd on any match card.
 */
export default function BoostsPage() {
  const { data: items, isPending, isError } = useBoosts();
  const displayName = useDisplayNames();
  const groups = useMemo(() => groupBySport(items ?? []), [items]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <BackButton className="-ml-1.5" />
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <h1 className="font-display text-lg">Boosts</h1>
      </div>

      {isPending && <MatchListSkeleton />}
      {isError && <Card className="text-danger">Failed to load boosts.</Card>}
      {groups.length === 0 && !isPending && !isError && (
        <Card className="text-text-secondary">No boosted prices available right now.</Card>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.sport}>
            <div className="mb-2 flex items-center gap-2">
              <SportIcon sport={group.sport} size={22} />
              <h2 className="font-display text-base">{displayName('SPORT', group.sport)}</h2>
            </div>
            <div className="space-y-3">
              {group.items.map((item) => (
                <BoostedSelectionRow key={`${item.matchId}-${item.marketId}-${item.selectionId}`} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

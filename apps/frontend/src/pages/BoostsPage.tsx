import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { BoostedSelectionSummary } from '@sportsbook/shared';
import { BackButton } from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';
import { SportCountryBadge } from '../components/ui/SportCountryBadge';
import { SportIcon } from '../components/ui/SportIcon';
import { BoostedOddsRow } from '../features/bet-slip/BoostedOddsRow';
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

function BoostedSelectionCard({ item }: { item: BoostedSelectionSummary }) {
  const displayName = useDisplayNames();
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
      <BoostedOddsRow
        matchId={item.matchId}
        matchLabel={matchLabel}
        competition={item.competition}
        marketId={item.marketId}
        marketName={item.marketName}
        selectionId={item.selectionId}
        selectionName={item.selectionName}
        odds={item.odds}
        previousOdds={item.previousOdds}
        maxStakeCents={item.maxStakeCents}
      />
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
                <BoostedSelectionCard key={`${item.matchId}-${item.marketId}-${item.selectionId}`} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

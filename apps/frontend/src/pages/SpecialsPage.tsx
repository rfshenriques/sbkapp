import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '@sportsbook/shared';
import { BackButton } from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';
import { SportCountryBadge } from '../components/ui/SportCountryBadge';
import { SportIcon } from '../components/ui/SportIcon';
import { MarketSelections } from '../features/bet-slip/MarketSelections';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { useSpecials } from '../features/odds-board/useSpecials';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { formatKickoff } from '../lib/formatKickoff';

interface SportGroup {
  sport: string;
  matches: Match[];
}

function groupBySport(matches: Match[]): SportGroup[] {
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const existing = groups.get(match.sport);
    if (existing) {
      existing.push(match);
    } else {
      groups.set(match.sport, [match]);
    }
  }
  return Array.from(groups.entries()).map(([sport, sportMatches]) => ({ sport, matches: sportMatches }));
}

/**
 * Every manual (trader-created) market, grouped per sport - the player
 * counterpart to the backoffice's Manual Markets page. Each match shown
 * here stacks all of its special markets together (Market.isSpecial is
 * already filtered server-side, see PublicSpecialsController), not
 * interspersed with the match's real markets the way MatchDetailPage does.
 */
export default function SpecialsPage() {
  const { data: matches, isPending, isError } = useSpecials();
  const displayName = useDisplayNames();
  const groups = useMemo(() => groupBySport(matches ?? []), [matches]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <BackButton className="-ml-1.5" />
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <h1 className="font-display text-lg">Specials</h1>
      </div>

      {isPending && <MatchListSkeleton />}
      {isError && <Card className="text-danger">Failed to load specials.</Card>}
      {groups.length === 0 && !isPending && !isError && (
        <Card className="text-text-secondary">No specials available right now.</Card>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.sport}>
            <div className="mb-2 flex items-center gap-2">
              <SportIcon sport={group.sport} size={22} />
              <h2 className="font-display text-base">{displayName('SPORT', group.sport)}</h2>
            </div>
            <div className="space-y-3">
              {group.matches.map((match) => {
                const homeTeamLabel = displayName('TEAM', match.homeTeam);
                const awayTeamLabel = displayName('TEAM', match.awayTeam);
                const matchLabel = `${homeTeamLabel} vs ${awayTeamLabel}`;
                return (
                  <Card key={match.id} className="bg-surface-2">
                    <div className="mb-1 flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      <SportCountryBadge sport={match.sport} country={match.country} />
                      <span className="min-w-0 flex-1 truncate">
                        {displayName('COMPETITION', match.competition)}
                      </span>
                      <span className="ml-auto shrink-0 text-highlight">
                        {formatKickoff(new Date(match.kickoff))}
                      </span>
                    </div>
                    <Link to={`/matches/${match.id}`} className="mb-3 block font-semibold">
                      {matchLabel}
                    </Link>
                    <div className="space-y-3">
                      {match.markets.map((market) => (
                        <div key={market.id}>
                          <p className="mb-1.5 text-xs font-semibold text-text-secondary">
                            {displayName('MARKET', market.name)}
                          </p>
                          <MarketSelections
                            matchId={match.id}
                            matchLabel={matchLabel}
                            competition={match.competition}
                            market={market}
                          />
                          {(market.maxStakeCents !== undefined || market.singlesOnly) && (
                            <p className="mt-1.5 text-[11px] text-text-secondary">
                              {[
                                market.maxStakeCents !== undefined
                                  ? `Max stake: €${(market.maxStakeCents / 100).toFixed(2)}`
                                  : null,
                                market.singlesOnly ? 'Singles only' : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

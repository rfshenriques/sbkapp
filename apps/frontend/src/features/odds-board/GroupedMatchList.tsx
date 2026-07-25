import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { SportCountryBadge } from '../../components/ui/SportCountryBadge';
import { SportIcon } from '../../components/ui/SportIcon';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { formatKickoff } from '../../lib/formatKickoff';
import type { SportGroup } from '../../lib/groupMatchesBySportAndCompetition';

interface GroupedMatchListProps {
  groups: SportGroup[];
}

/** Renders a sport > competition > match list, each match linking straight to its detail page - shared by CampaignMatchesPage and BrowsePage, both of which show "matches from a chosen set of sports/competitions" grouped the same way. */
export function GroupedMatchList({ groups }: GroupedMatchListProps) {
  const displayName = useDisplayNames();

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.sport}>
          <div className="mb-2 flex items-center gap-2">
            <SportIcon sport={group.sport} size={22} />
            <h2 className="font-display text-base">{displayName('SPORT', group.sport)}</h2>
          </div>
          <div className="space-y-4">
            {group.competitions.map((competitionGroup) => (
              <div key={competitionGroup.competition}>
                <p className="mb-1.5 text-xs font-semibold text-text-secondary">
                  {displayName('COMPETITION', competitionGroup.competition)}
                </p>
                <div className="space-y-2">
                  {competitionGroup.matches.map((match) => {
                    const homeTeamLabel = displayName('TEAM', match.homeTeam);
                    const awayTeamLabel = displayName('TEAM', match.awayTeam);
                    return (
                      <Link key={match.id} to={`/matches/${match.id}`}>
                        <Card className="bg-surface-2">
                          <div className="mb-1 flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                            <SportCountryBadge sport={match.sport} country={match.country} />
                            <span className="ml-auto shrink-0 text-highlight">
                              {formatKickoff(new Date(match.kickoff))}
                            </span>
                          </div>
                          <p className="font-semibold">
                            {homeTeamLabel} <span className="text-text-muted">vs</span> {awayTeamLabel}
                          </p>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

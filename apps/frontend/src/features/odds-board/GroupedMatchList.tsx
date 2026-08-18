import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { CountryFlag } from '../../components/ui/CountryFlag';
import { SportIcon } from '../../components/ui/SportIcon';
import { TeamColorAccent } from '../../components/ui/TeamColorAccent';
import { MarketSelections } from '../bet-slip/MarketSelections';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { usePrefetchMatchDetail } from './usePrefetchMatchDetail';
import { useTeamColors } from './useTeamColors';
import { fallbackTeamColor } from '../../lib/fallbackTeamColor';
import { formatKickoff } from '../../lib/formatKickoff';
import type { Match } from '@sportsbook/shared';
import type { SportGroup } from '../../lib/groupMatchesBySportAndCompetition';

interface GroupedMatchListProps {
  groups: SportGroup[];
}

interface GroupedMatchRowProps {
  match: Match;
}

/**
 * One match row within a sport > competition group - the sport/country are
 * already shown once at the competition header above, so this only carries
 * what's specific to the match itself: teams, kickoff, and odds (unlike
 * MatchCard, which repeats the sport/country badge and competition name on
 * every card since it's used in flat, ungrouped lists).
 */
function GroupedMatchRow({ match }: GroupedMatchRowProps) {
  const matchResult = match.markets.find((market) => market.id === 'match-result');
  const prefetchMatchDetail = usePrefetchMatchDetail();
  const navigate = useNavigate();
  const displayName = useDisplayNames();
  const homeTeamLabel = displayName('TEAM', match.homeTeam);
  const awayTeamLabel = displayName('TEAM', match.awayTeam);
  const matchLabel = `${homeTeamLabel} vs ${awayTeamLabel}`;
  const matchHref = `/matches/${match.id}`;
  const teamColors = useTeamColors();

  return (
    <Card
      className="match-card fade-in-up cursor-pointer transition-colors"
      onClick={() => navigate(matchHref)}
      onMouseEnter={() => prefetchMatchDetail(match.id)}
      onTouchStart={() => prefetchMatchDetail(match.id)}
    >
      <Link
        to={matchHref}
        className="block"
        aria-label={matchLabel}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
            <TeamColorAccent colorHex={teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam)} />
            <span className="min-w-0 text-center font-semibold">{homeTeamLabel}</span>
          </span>
          <span className="mt-0.5 shrink-0 text-xs font-bold text-text-muted tabular-nums">vs</span>
          <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
            <span className="min-w-0 text-center font-semibold">{awayTeamLabel}</span>
            <TeamColorAccent colorHex={teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam)} />
          </span>
        </div>
        <p className="mt-1 text-center text-xs font-semibold text-highlight">
          {formatKickoff(new Date(match.kickoff))}
        </p>
      </Link>
      {matchResult ? (
        <div className="mt-3">
          <MarketSelections
            matchId={match.id}
            matchLabel={matchLabel}
            competition={match.competition}
            market={matchResult}
          />
        </div>
      ) : (
        <Link
          to={matchHref}
          onClick={(event) => event.stopPropagation()}
          className="btn-primary mt-3 flex w-full items-center justify-center"
        >
          Bet Now
        </Link>
      )}
    </Card>
  );
}

/** Renders a sport > country+league > match list, each match linking straight to its detail page - shared by CampaignMatchesPage and BrowsePage, both of which show "matches from a chosen set of sports/competitions" grouped the same way. */
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
                <div className="mb-1.5 flex items-center gap-1.5">
                  <CountryFlag country={competitionGroup.matches[0]!.country} size={14} />
                  <p className="text-xs font-semibold text-text-secondary">
                    {displayName('COMPETITION', competitionGroup.competition)}
                  </p>
                </div>
                <div className="space-y-3">
                  {competitionGroup.matches.map((match) => (
                    <GroupedMatchRow key={match.id} match={match} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

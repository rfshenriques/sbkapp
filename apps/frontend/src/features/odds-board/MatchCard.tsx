import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { SportCountryBadge } from '../../components/ui/SportCountryBadge';
import { TeamColorAccent } from '../../components/ui/TeamColorAccent';
import { MarketSelections } from '../bet-slip/MarketSelections';
import { usePrefetchMatchDetail } from './usePrefetchMatchDetail';
import { useLiveMatch } from '../match-detail/useLiveMatch';
import { useTeamColors } from './useTeamColors';
import { formatKickoff } from '../../lib/formatKickoff';
import type { Match } from '@sportsbook/shared';

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const matchResult = match.markets.find((market) => market.id === 'match-result');
  const prefetchMatchDetail = usePrefetchMatchDetail();
  const navigate = useNavigate();
  const matchLabel = `${match.homeTeam} vs ${match.awayTeam}`;
  const kickoff = new Date(match.kickoff);
  const matchHref = `/matches/${match.id}`;
  const { data: liveState } = useLiveMatch(match.id, match.isLive);
  const teamColors = useTeamColors();

  const centerLabel = match.isLive
    ? liveState
      ? `${liveState.homeScore} : ${liveState.awayScore}`
      : ':'
    : 'vs';

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-text-muted"
      onClick={() => navigate(matchHref)}
      onMouseEnter={() => prefetchMatchDetail(match.id)}
      onTouchStart={() => prefetchMatchDetail(match.id)}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <SportCountryBadge sport={match.sport} country={match.country} />
            <span>{match.competition}</span>
            {!match.isLive && (
              <span className="ml-auto text-highlight">{formatKickoff(kickoff)}</span>
            )}
          </p>
          {/* Real link kept for keyboard/screen-reader navigation and a
              correct accessible name - the card's onClick above is a mouse/
              touch convenience that enlarges the clickable area to the
              whole card, not the primary access path. Teams sit at each
              side with vs/score centered between them. */}
          <Link
            to={matchHref}
            className="group flex items-center gap-2"
            aria-label={matchLabel}
            // Avoid a duplicate history entry from the card's own onClick
            // (React Router navigates internally on the link's click before
            // it bubbles to the card).
            onClick={(event) => event.stopPropagation()}
          >
            <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5 sm:justify-center">
              <TeamColorAccent colorHex={teamColors.get(match.homeTeam)} />
              <span className="min-w-0 truncate font-semibold group-hover:underline">{match.homeTeam}</span>
            </span>
            <span className="shrink-0 text-xs font-bold text-text-muted tabular-nums">
              {centerLabel}
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:justify-center">
              <span className="min-w-0 truncate font-semibold group-hover:underline">{match.awayTeam}</span>
              <TeamColorAccent colorHex={teamColors.get(match.awayTeam)} />
            </span>
          </Link>
        </div>
        {match.isLive && (
          <span className="slash shrink-0 bg-price-down px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white">
            LIVE
          </span>
        )}
      </div>
      {matchResult && (
        <div className="mt-3">
          <MarketSelections matchId={match.id} matchLabel={matchLabel} market={matchResult} />
        </div>
      )}
    </Card>
  );
}

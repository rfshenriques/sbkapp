import type { CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { SportCountryBadge } from '../../components/ui/SportCountryBadge';
import { MarketSelections } from '../bet-slip/MarketSelections';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { usePrefetchMatchDetail } from './usePrefetchMatchDetail';
import { useLiveScoreboard } from '../match-detail/useLiveScoreboard';
import { useTeamColors } from './useTeamColors';
import { fallbackTeamColor } from '../../lib/fallbackTeamColor';
import { formatKickoff } from '../../lib/formatKickoff';
import type { Match } from '@sportsbook/shared';

interface MatchCardProps {
  match: Match;
  /** Passed through to the root Card - callers use this to stagger a list's entrance (see fade-in-up's animation-delay). */
  style?: CSSProperties;
  /** Plays the entrance animation. Defaults to true; callers that re-render
   * the same card list in place (e.g. switching a filter tab, not a genuine
   * first paint) pass false so cards don't replay a fade/slide-up on every
   * click. */
  animate?: boolean;
}

/** "5 markets" / "1 market" - real data (match.markets.length), never a fabricated count. */
function marketCountLabel(count: number): string {
  return `${count} market${count === 1 ? '' : 's'}`;
}

export function MatchCard({ match, style, animate = true }: MatchCardProps) {
  const matchResult = match.markets.find((market) => market.id === 'match-result');
  const prefetchMatchDetail = usePrefetchMatchDetail();
  const navigate = useNavigate();
  const displayName = useDisplayNames();
  const homeTeamLabel = displayName('TEAM', match.homeTeam);
  const awayTeamLabel = displayName('TEAM', match.awayTeam);
  const matchLabel = `${homeTeamLabel} vs ${awayTeamLabel}`;
  const kickoff = new Date(match.kickoff);
  const matchHref = `/matches/${match.id}`;
  const { data: scoreboard } = useLiveScoreboard();
  const liveState = scoreboard?.[match.id];
  const teamColors = useTeamColors();

  return (
    <Card
      className={`${animate ? 'fade-in-up ' : ''}match-card cursor-pointer transition-colors`}
      style={style}
      onClick={() => navigate(matchHref)}
      onMouseEnter={() => prefetchMatchDetail(match.id)}
      onTouchStart={() => prefetchMatchDetail(match.id)}
    >
      {/* Competition on the left, kickoff time (or the live badge, once
          in-play) on the right - one row, not stacked, so a live match
          doesn't need its own absolutely-positioned corner badge to avoid
          overlapping the competition text below it. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-text-muted">
          <SportCountryBadge sport={match.sport} country={match.country} size={14} />
          <span className="min-w-0 flex-1 truncate">
            {displayName('COUNTRY', match.country)} · {displayName('COMPETITION', match.competition)}
          </span>
        </p>
        {match.isLive ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-price-down px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white">
            <span className="h-1 w-1 rounded-full bg-white" aria-hidden="true" />
            LIVE{liveState ? ` ${liveState.minute}'` : ''}
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-semibold text-text-secondary">{formatKickoff(kickoff)}</span>
        )}
      </div>

      {/* Outcome rows, not a stacked team list plus a separate odds grid -
          each row IS the team (real color-coded edge marker, same source
          TeamBadge/TeamColorAccent use elsewhere) with its own price pill,
          live score inline where the team name used to be. One aria-labeled
          Link still wraps the whole block for navigation/prefetch, same
          contract every other match surface already relies on. */}
      <Link
        to={matchHref}
        className="mb-2.5 block min-w-0"
        aria-label={matchLabel}
        // Avoid a duplicate history entry from the card's own onClick
        // (React Router navigates internally on the link's click before it
        // bubbles to the card).
        onClick={(event) => event.stopPropagation()}
      >
        {matchResult ? (
          <MarketSelections
            matchId={match.id}
            matchLabel={matchLabel}
            competition={match.competition}
            market={matchResult}
            homeTeamLabel={homeTeamLabel}
            awayTeamLabel={awayTeamLabel}
            layout="row"
            homeColorHex={teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam)}
            awayColorHex={teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam)}
            homeScore={match.isLive ? (liveState ? liveState.homeScore : '-') : undefined}
            awayScore={match.isLive ? (liveState ? liveState.awayScore : '-') : undefined}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="truncate text-sm font-semibold">{homeTeamLabel}</span>
            <span className="truncate text-sm font-semibold">{awayTeamLabel}</span>
          </div>
        )}
      </Link>

      {matchResult ? (
        <p className="text-[10.5px] font-semibold text-text-muted">{marketCountLabel(match.markets.length)}</p>
      ) : (
        // No odds to show inline yet (feed hasn't priced this match, or
        // every market's currently suspended) - a full-width CTA into the
        // match detail page instead of leaving the card odds-less/dead.
        <Link
          to={matchHref}
          onClick={(event) => event.stopPropagation()}
          className="btn-primary flex w-full items-center justify-center"
        >
          Bet Now
        </Link>
      )}
    </Card>
  );
}

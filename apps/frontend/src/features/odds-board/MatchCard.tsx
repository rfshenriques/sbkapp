import type { CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { ChevronIcon } from '../../components/ui/ChevronIcon';
import { SportCountryBadge } from '../../components/ui/SportCountryBadge';
import { TeamColorAccent } from '../../components/ui/TeamColorAccent';
import { MarketSelections } from '../bet-slip/MarketSelections';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { usePrefetchMatchDetail } from './usePrefetchMatchDetail';
import { useLiveMatch } from '../match-detail/useLiveMatch';
import { useTeamColors } from './useTeamColors';
import { fallbackTeamColor } from '../../lib/fallbackTeamColor';
import { formatKickoff } from '../../lib/formatKickoff';
import { matchPeriodLabel } from '../../lib/matchPeriodLabel';
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
  const { data: liveState } = useLiveMatch(match.id, match.isLive);
  const teamColors = useTeamColors();

  return (
    <Card
      className={`${animate ? 'fade-in-up ' : ''}match-card relative cursor-pointer transition-colors`}
      style={style}
      onClick={() => navigate(matchHref)}
      onMouseEnter={() => prefetchMatchDetail(match.id)}
      onTouchStart={() => prefetchMatchDetail(match.id)}
    >
      <p className="mb-1 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-text-muted">
        <SportCountryBadge sport={match.sport} country={match.country} size={14} />
        <span className="min-w-0 flex-1 truncate">
          {displayName('COUNTRY', match.country)} · {displayName('COMPETITION', match.competition)}
        </span>
      </p>

      <div className="mb-2 flex items-center justify-between gap-2">
        {match.isLive ? (
          // The red LIVE pill below already says "live" - this slot only
          // adds something when there's a genuine period/minute to show,
          // rather than repeating "Live" as plain text next to it.
          liveState && (
            <span className="text-[11px] font-bold text-highlight">
              {matchPeriodLabel(liveState.period)} · {liveState.minute}'
            </span>
          )
        ) : (
          <span className="text-[11px] font-semibold text-text-secondary">{formatKickoff(kickoff)}</span>
        )}
        {match.isLive && (
          <span className="ml-auto shrink-0 rounded-full bg-price-down px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white">
            LIVE
          </span>
        )}
      </div>

      {/* Team rows always stacked, one per line - a narrow card splitting
          its width between two team names plus a centered "vs" truncates
          both names hard, and stacking reads closer to how a real sportsbook
          list row shows the two sides regardless of live/pre-match state. */}
      <Link
        to={matchHref}
        className="mb-2.5 block min-w-0 space-y-1.5"
        aria-label={matchLabel}
        // Avoid a duplicate history entry from the card's own onClick
        // (React Router navigates internally on the link's click before it
        // bubbles to the card).
        onClick={(event) => event.stopPropagation()}
      >
        <span className="flex items-center gap-2">
          <TeamColorAccent
            colorHex={teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam)}
            className="h-2 w-2 shrink-0 rounded-full"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{homeTeamLabel}</span>
          {match.isLive && (
            <span className="shrink-0 font-display text-sm tabular-nums">
              {liveState ? liveState.homeScore : '-'}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <TeamColorAccent
            colorHex={teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam)}
            className="h-2 w-2 shrink-0 rounded-full"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{awayTeamLabel}</span>
          {match.isLive && (
            <span className="shrink-0 font-display text-sm tabular-nums">
              {liveState ? liveState.awayScore : '-'}
            </span>
          )}
        </span>
      </Link>

      {matchResult ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {displayName('MARKET', matchResult.name)}
          </p>
          <div className="flex items-stretch gap-1.5">
            <div className="min-w-0 flex-1">
              <MarketSelections
                matchId={match.id}
                matchLabel={matchLabel}
                competition={match.competition}
                market={matchResult}
                variant="inline"
                reserveBoostSpace
              />
            </div>
            {/* Same navigation as the rest of the card - a visual affordance
                into the match's full market list, not a separate expand
                behavior (the card doesn't inline any markets beyond this
                one). */}
            <Link
              to={matchHref}
              onClick={(event) => event.stopPropagation()}
              aria-label="More markets"
              className="flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-hover px-2.5 text-text-secondary transition-colors hover:text-text-primary"
            >
              <ChevronIcon width={14} height={14} className="-rotate-90" />
            </Link>
          </div>
        </div>
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

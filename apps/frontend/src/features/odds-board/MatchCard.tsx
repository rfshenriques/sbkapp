import type { CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
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
}

export function MatchCard({ match, style }: MatchCardProps) {
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
      // bg-surface reads almost identically to the page's own bg-background
      // behind it (both near-black) - bg-surface-2 gives the card real
      // separation instead of nearly vanishing into the page.
      className="fade-in-up cursor-pointer bg-surface-2 transition-colors hover:border-text-muted"
      style={style}
      onClick={() => navigate(matchHref)}
      onMouseEnter={() => prefetchMatchDetail(match.id)}
      onTouchStart={() => prefetchMatchDetail(match.id)}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-1 flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <SportCountryBadge sport={match.sport} country={match.country} />
            <span className="min-w-0 flex-1 truncate">
              {displayName('COMPETITION', match.competition)}
            </span>
            {match.isLive
              ? liveState && (
                  <span className="ml-auto shrink-0 truncate text-highlight">
                    {matchPeriodLabel(liveState.period)} · {liveState.minute}'
                  </span>
                )
              : <span className="ml-auto shrink-0 text-highlight">{formatKickoff(kickoff)}</span>}
          </p>
          {/* Real link kept for keyboard/screen-reader navigation and a
              correct accessible name - the card's onClick above is a mouse/
              touch convenience that enlarges the clickable area to the
              whole card, not the primary access path. */}
          {match.isLive ? (
            // Stacked rows (not side-by-side with a centered score, like the
            // pre-match layout below) - a narrow carousel card splitting its
            // width between two team names plus a centered score truncates
            // both team names hard. Each row gets nearly the full card width
            // instead, with the score right-aligned.
            <Link
              to={matchHref}
              className="block min-w-0 space-y-1"
              aria-label={matchLabel}
              onClick={(event) => event.stopPropagation()}
            >
              <span className="flex items-center gap-1.5">
                <TeamColorAccent colorHex={teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam)} />
                <span className="min-w-0 flex-1 truncate font-semibold">{homeTeamLabel}</span>
                <span className="shrink-0 font-display text-sm tabular-nums">
                  {liveState ? liveState.homeScore : '-'}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <TeamColorAccent colorHex={teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam)} />
                <span className="min-w-0 flex-1 truncate font-semibold">{awayTeamLabel}</span>
                <span className="shrink-0 font-display text-sm tabular-nums">
                  {liveState ? liveState.awayScore : '-'}
                </span>
              </span>
            </Link>
          ) : (
            <Link
              to={matchHref}
              className="flex items-center gap-2"
              aria-label={matchLabel}
              // Avoid a duplicate history entry from the card's own onClick
              // (React Router navigates internally on the link's click
              // before it bubbles to the card).
              onClick={(event) => event.stopPropagation()}
            >
              <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
                <TeamColorAccent colorHex={teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam)} />
                <span className="min-w-0 truncate font-semibold">{homeTeamLabel}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-text-muted tabular-nums">vs</span>
              <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
                <span className="min-w-0 truncate font-semibold">{awayTeamLabel}</span>
                <TeamColorAccent colorHex={teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam)} />
              </span>
            </Link>
          )}
        </div>
        {match.isLive && (
          <span className="shrink-0 rounded-full bg-price-down px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white">
            LIVE
          </span>
        )}
      </div>
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
        // No odds to show inline yet (feed hasn't priced this match, or
        // every market's currently suspended) - a full-width CTA into the
        // match detail page instead of leaving the card odds-less/dead.
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

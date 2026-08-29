import type { CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { SportCountryBadge } from '../../components/ui/SportCountryBadge';
import { TeamBadge } from '../../components/ui/TeamBadge';
import { MarketSelections } from '../bet-slip/MarketSelections';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { usePrefetchMatchDetail } from './usePrefetchMatchDetail';
import { useLiveScoreboard } from '../match-detail/useLiveScoreboard';
import { useTeamColors } from './useTeamColors';
import { useTeamAcronyms } from './useTeamAcronyms';
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
  const teamAcronyms = useTeamAcronyms();

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

      {/* Team columns sit either side of a centered vs/score capsule
          instead of a stacked list - each team gets the same acronym
          badge Match of the Day uses (real team color + initials) as an
          honest stand-in for a crest, since the data model has no team
          logos. */}
      <Link
        to={matchHref}
        className="mb-3 flex items-center justify-between gap-2"
        aria-label={matchLabel}
        // Avoid a duplicate history entry from the card's own onClick
        // (React Router navigates internally on the link's click before it
        // bubbles to the card).
        onClick={(event) => event.stopPropagation()}
      >
        <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <TeamBadge
            name={match.homeTeam}
            colorHex={teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam)}
            acronym={teamAcronyms.get(match.homeTeam)}
          />
          <span className="max-w-full truncate text-center text-[12.5px] font-semibold">{homeTeamLabel}</span>
        </span>
        <span className="flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 px-3.5 py-1.5">
          {match.isLive ? (
            <>
              <span className="font-display text-sm tabular-nums">{liveState ? liveState.homeScore : '-'}</span>
              <span className="text-[10px] font-semibold text-text-muted">v</span>
              <span className="font-display text-sm tabular-nums">{liveState ? liveState.awayScore : '-'}</span>
            </>
          ) : (
            <span className="text-[10px] font-bold tracking-wide text-text-muted uppercase">vs</span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <TeamBadge
            name={match.awayTeam}
            colorHex={teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam)}
            acronym={teamAcronyms.get(match.awayTeam)}
          />
          <span className="max-w-full truncate text-center text-[12.5px] font-semibold">{awayTeamLabel}</span>
        </span>
      </Link>

      {matchResult ? (
        <div>
          <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {displayName('MARKET', matchResult.name)}
          </p>
          <MarketSelections
            matchId={match.id}
            matchLabel={matchLabel}
            competition={match.competition}
            market={matchResult}
            homeTeamLabel={homeTeamLabel}
            awayTeamLabel={awayTeamLabel}
          />
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

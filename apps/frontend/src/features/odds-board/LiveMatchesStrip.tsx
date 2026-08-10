import { Link, useLocation } from 'react-router-dom';
import { SportCountryBadge } from '../../components/ui/SportCountryBadge';
import { LiveIcon } from '../../components/ui/NavIcons';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { useLiveMatch } from '../match-detail/useLiveMatch';
import { matchPeriodLabel } from '../../lib/matchPeriodLabel';
import { usePrefetchMatchDetail } from './usePrefetchMatchDetail';
import { useMatches } from './useMatches';
import type { Match } from '@sportsbook/shared';

/** Home, Sport, and Live (which is just SportPage at /live) already have
 * their own full live-match browsing (a whole section or the live/upcoming
 * tabs) - a second, redundant slider there would just be visual noise.
 * Challenges is its own focused, campaign-only page - live match browsing
 * doesn't belong there either. */
const EXCLUDED_ROUTES = [/^\/$/, /^\/sports\//, /^\/live$/, /^\/challenges$/];

const MAX_CHIPS = 12;

function LiveMatchChip({ match }: { match: Match }) {
  const displayName = useDisplayNames();
  const prefetchMatchDetail = usePrefetchMatchDetail();
  const { data: liveState } = useLiveMatch(match.id, true);
  const homeTeamLabel = displayName('TEAM', match.homeTeam);
  const awayTeamLabel = displayName('TEAM', match.awayTeam);

  return (
    <Link
      to={`/matches/${match.id}`}
      className="flex shrink-0 snap-start items-center gap-2 rounded-xl border border-border bg-surface-2 py-2 pr-3 pl-2 transition-colors hover:border-text-muted"
      onMouseEnter={() => prefetchMatchDetail(match.id)}
      onTouchStart={() => prefetchMatchDetail(match.id)}
    >
      <SportCountryBadge sport={match.sport} country={match.country} size={16} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-highlight">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-price-down" aria-hidden="true" />
          {liveState ? `${matchPeriodLabel(liveState.period)} · ${liveState.minute}'` : 'Live'}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <span className="max-w-[7rem] truncate">{homeTeamLabel}</span>
          <span className="shrink-0 tabular-nums text-text-muted">
            {liveState ? `${liveState.homeScore}-${liveState.awayScore}` : 'vs'}
          </span>
          <span className="max-w-[7rem] truncate">{awayTeamLabel}</span>
        </span>
      </span>
    </Link>
  );
}

/**
 * A low, horizontally-scrollable strip of every currently-live match, so a
 * player deep in some other section (match detail, My Bets, Challenges,
 * Boosts, ...) can still jump straight to another live game without
 * backing out to Home/Sport first. Renders nothing when there's nothing
 * live, or on the pages that already have their own live-match browsing
 * (see EXCLUDED_ROUTES).
 */
export function LiveMatchesStrip() {
  const location = useLocation();
  const { data: matches } = useMatches();

  if (EXCLUDED_ROUTES.some((pattern) => pattern.test(location.pathname))) return null;

  const liveMatches = (matches ?? []).filter((match) => match.isLive).slice(0, MAX_CHIPS);
  if (liveMatches.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-text-secondary">
        <LiveIcon width={14} height={14} />
        Live now
      </div>
      <div
        className="scrollbar-hide flex snap-x gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Live matches"
      >
        {liveMatches.map((match) => (
          <LiveMatchChip key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
}

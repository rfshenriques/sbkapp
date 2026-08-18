import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '@sportsbook/shared';
import { SportIcon } from '../../components/ui/SportIcon';
import { TopNavIcon } from '../../components/ui/TopNavIcon';
import type { TopNavItem } from '../../lib/backendApi';
import { useMatches } from '../odds-board/useMatches';
import { competitionSportMap } from './buildSportTree';
import { useTopNavItems } from './useTopNavItems';

/**
 * A COMPETITION item has no sport of its own (see backend's TopNavItem) -
 * resolved from the live matches feed the same way Sidebar's "Top
 * Competitions" quicklinks do, falling back to the /sports/all umbrella when
 * a competition's sport can't be determined (no live match for it right
 * now). Every destination but MATCH (which lands on the match detail page,
 * not a browsable list) carries `from=quicklink` - SportPage reads it once
 * on mount to hide its own sport/date filters for a quicklink-driven
 * landing (see SportPage's fromQuicklink) without affecting the identical
 * URLs Sidebar's own competition/sport links produce.
 */
function hrefForItem(item: TopNavItem, competitionSports: Map<string, string>): string {
  switch (item.kind) {
    case 'SPORT':
      return `/sports/${encodeURIComponent(item.sport ?? '')}?from=quicklink`;
    case 'COMPETITION': {
      const competition = item.competition ?? '';
      const sport = competitionSports.get(competition);
      return sport
        ? `/sports/${encodeURIComponent(sport)}?competition=${encodeURIComponent(competition)}&from=quicklink`
        : `/sports/all?competition=${encodeURIComponent(competition)}&from=quicklink`;
    }
    case 'MATCH':
      return `/matches/${encodeURIComponent(item.matchId ?? '')}`;
    case 'TODAY':
      return '/sports/all?date=today&from=quicklink';
    case 'TOMORROW':
      return '/sports/all?date=tomorrow&from=quicklink';
    case 'BOOSTS':
      return '/boosts';
    case 'SPECIALS':
      return '/specials';
    case 'CHALLENGE':
      return `/campaigns/${encodeURIComponent(item.betAndGetCampaignId ?? '')}`;
    case 'LEADERBOARD':
      return `/leaderboards/${encodeURIComponent(item.leaderboardCampaignId ?? '')}`;
  }
}

/**
 * A SPORT/COMPETITION/MATCH item always renders its actual sport's icon
 * (see SportIcon) rather than the staff-picked generic TopNavIconKey - a
 * football quicklink should look like football, not whichever star/flag/
 * trophy glyph happened to get chosen. TODAY/TOMORROW have no sport to
 * derive from, so those still use the manual icon (see TopNavIcon below).
 * Undefined when a COMPETITION/MATCH item's sport can't be resolved from
 * the live feed right now (no live match for it) - caller falls back to
 * the manual icon rather than rendering nothing.
 */
function resolvedSport(item: TopNavItem, matches: Match[] | undefined, competitionSports: Map<string, string>): string | undefined {
  if (item.kind === 'SPORT') return item.sport ?? undefined;
  if (item.kind === 'COMPETITION') return competitionSports.get(item.competition ?? '');
  if (item.kind === 'MATCH') return matches?.find((match) => match.id === item.matchId)?.sport;
  return undefined;
}

/**
 * CMS-configured second navbar (see the backoffice's Top nav page) - a
 * staff-built, freely-ordered mix of sport/competition/match shortcuts and
 * the two auto-updating Today/Tomorrow timeframe views. Renders nothing at
 * all with no items configured, rather than a placeholder (see CLAUDE.md's
 * "only build what's backed by real data") - AppShell only mounts this
 * inside the header, which already handles a variable-height second row via
 * its own ResizeObserver.
 *
 * Icon-only, not a text label. A SPORT/COMPETITION/MATCH entry always shows
 * its actual sport's icon (see resolvedSport/SportIcon) - a football
 * quicklink looks like football, not a staff-picked glyph. TODAY/TOMORROW
 * have no sport to derive from, so those use a staff-picked icon from a
 * fixed, consistently-designed generic set instead (see TopNavIcon). Reuses
 * .icon-toggle, the same circular pill the kickoff-time filter uses, rather
 * than a new one-off shape.
 */
export function SecondaryNavBar() {
  const { data: items } = useTopNavItems();
  const { data: matches } = useMatches();
  const competitionSports = useMemo(() => competitionSportMap(matches ?? []), [matches]);

  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Quick links"
      className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-2.5 sm:mx-0 sm:px-0"
      data-horizontal-scroll="true"
    >
      {items.map((item) => {
        const sport = resolvedSport(item, matches, competitionSports);
        return (
          <Link
            key={item.id}
            to={hrefForItem(item, competitionSports)}
            className="icon-toggle shrink-0"
            aria-label={item.label}
            title={item.label}
          >
            {sport ? <SportIcon sport={sport} size={16} /> : <TopNavIcon icon={item.icon} width={16} height={16} />}
          </Link>
        );
      })}
    </nav>
  );
}

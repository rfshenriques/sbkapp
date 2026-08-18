import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { TopNavItem } from '../../lib/backendApi';
import { useMatches } from '../odds-board/useMatches';
import { competitionSportMap } from './buildSportTree';
import { useTopNavItems } from './useTopNavItems';

/**
 * A COMPETITION item has no sport of its own (see backend's TopNavItem) -
 * resolved from the live matches feed the same way Sidebar's "Top
 * Competitions" quicklinks do, falling back to the /sports/all umbrella when
 * a competition's sport can't be determined (no live match for it right
 * now).
 */
function hrefForItem(item: TopNavItem, competitionSports: Map<string, string>): string {
  if (item.kind === 'SPORT') {
    return `/sports/${encodeURIComponent(item.sport ?? '')}`;
  }
  if (item.kind === 'COMPETITION') {
    const competition = item.competition ?? '';
    const sport = competitionSports.get(competition);
    return sport
      ? `/sports/${encodeURIComponent(sport)}?competition=${encodeURIComponent(competition)}`
      : `/sports/all?competition=${encodeURIComponent(competition)}`;
  }
  if (item.kind === 'MATCH') {
    return `/matches/${encodeURIComponent(item.matchId ?? '')}`;
  }
  return item.kind === 'TODAY' ? '/sports/all?date=today' : '/sports/all?date=tomorrow';
}

/**
 * CMS-configured second navbar (see the backoffice's Top nav page) - a
 * staff-built, freely-ordered mix of sport/competition/match shortcuts and
 * the two auto-updating Today/Tomorrow timeframe views. Renders nothing at
 * all with no items configured, rather than a placeholder (see CLAUDE.md's
 * "only build what's backed by real data") - AppShell only mounts this
 * inside the header, which already handles a variable-height second row via
 * its own ResizeObserver.
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
      {items.map((item) => (
        <Link key={item.id} to={hrefForItem(item, competitionSports)} className="tab shrink-0">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

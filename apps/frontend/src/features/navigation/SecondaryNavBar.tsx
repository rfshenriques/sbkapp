import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '@sportsbook/shared';
import { CountryFlag } from '../../components/ui/CountryFlag';
import { SportIcon } from '../../components/ui/SportIcon';
import { TopNavIcon } from '../../components/ui/TopNavIcon';
import type { TopNavItem } from '../../lib/backendApi';
import { useLeaderboardCampaigns } from '../leaderboards/useLeaderboardCampaigns';
import { matchDateBucket } from '../../lib/matchDateBucket';
import { useBoosts } from '../odds-board/useBoosts';
import { useMatches } from '../odds-board/useMatches';
import { useSpecials } from '../odds-board/useSpecials';
import { competitionCountryMap, competitionSportMap } from './buildSportTree';
import { useTopNavItems } from './useTopNavItems';

interface QuicklinkAvailability {
  matches: Match[] | undefined;
  boosts: unknown[] | undefined;
  specials: unknown[] | undefined;
  leaderboardCampaignIds: Set<string> | undefined;
}

/**
 * Whether this quicklink actually has something to land on right now - a
 * competition with no games today, a Today/Tomorrow with nothing kicking
 * off, or a Boosts/Specials/Leaderboard link with nothing currently active
 * is a dead end for the player, not a real shortcut. While the relevant
 * data is still loading (undefined), the item is shown optimistically
 * rather than flashing away and back once the request resolves - only a
 * definitively-empty result hides it. CHALLENGE has no player-facing "list
 * every active Bet & Get campaign" endpoint to check against (campaigns
 * are only ever resolved per-match/per-bet, see CampaignContextBanner), so
 * it's always shown, same as before this filtering existed.
 */
function hasContent(item: TopNavItem, availability: QuicklinkAvailability): boolean {
  switch (item.kind) {
    case 'SPORT':
      return !availability.matches || availability.matches.some((match) => match.sport === item.sport);
    case 'COMPETITION':
      return !availability.matches || availability.matches.some((match) => match.competition === item.competition);
    case 'MATCH':
      return !availability.matches || availability.matches.some((match) => match.id === item.matchId);
    case 'TODAY':
      return (
        !availability.matches || availability.matches.some((match) => matchDateBucket(match) === 'today')
      );
    case 'TOMORROW':
      return (
        !availability.matches || availability.matches.some((match) => matchDateBucket(match) === 'tomorrow')
      );
    case 'BOOSTS':
      return !availability.boosts || availability.boosts.length > 0;
    case 'SPECIALS':
      return !availability.specials || availability.specials.length > 0;
    case 'LEADERBOARD':
      return !availability.leaderboardCampaignIds || availability.leaderboardCampaignIds.has(item.leaderboardCampaignId ?? '');
    case 'CHALLENGE':
      return true;
  }
}

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
 * A SPORT/MATCH item always renders its actual sport's icon (see SportIcon)
 * rather than the staff-picked generic TopNavIconKey - a football quicklink
 * should look like football, not whichever star/flag/trophy glyph happened
 * to get chosen. A COMPETITION item shows its country flag instead (see
 * ItemIcon below) - the competition's own sport is already implied by its
 * label/destination, so the flag is the more identifying glyph of the two
 * (e.g. distinguishing "Premier League" from "La Liga" at a glance, which a
 * shared football icon can't). TODAY/TOMORROW have no sport to derive from,
 * so those still use the manual icon (see TopNavIcon below). Undefined when
 * a MATCH item's sport can't be resolved from the live feed right now (no
 * live match for it) - caller falls back to the manual icon rather than
 * rendering nothing.
 */
function resolvedSport(item: TopNavItem, matches: Match[] | undefined): string | undefined {
  if (item.kind === 'SPORT') return item.sport ?? undefined;
  if (item.kind === 'MATCH') return matches?.find((match) => match.id === item.matchId)?.sport;
  return undefined;
}

function ItemIcon({
  item,
  matches,
  competitionCountries,
}: {
  item: TopNavItem;
  matches: Match[] | undefined;
  competitionCountries: Map<string, string>;
}) {
  if (item.kind === 'COMPETITION') {
    const country = competitionCountries.get(item.competition ?? '');
    return country ? (
      <CountryFlag country={country} size={16} />
    ) : (
      <TopNavIcon icon={item.icon} width={16} height={16} />
    );
  }
  const sport = resolvedSport(item, matches);
  return sport ? <SportIcon sport={sport} size={16} /> : <TopNavIcon icon={item.icon} width={16} height={16} />;
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
 * Icon + label pill (reuses .tab, the same primitive Sidebar's suggested-
 * sport chips use, sized down via .tab-sm - see index.css), not an icon-only
 * glyph - each item's label (either the kind's own default name, or the
 * staff-set custom name from the backoffice's "Display label" field) needs
 * to actually be visible to a player, not just present as a hover-only
 * title attribute a touch device never shows. Smaller than a regular .tab:
 * staff can add as many quicklinks as they want, and the full-size text
 * only fit 3-4 before running out of header width and forcing every
 * remaining one off-screen behind the scroll. A SPORT/MATCH entry's icon
 * always reflects its actual sport (see ItemIcon/SportIcon) - a football
 * quicklink looks like football, not a staff-picked glyph. A COMPETITION
 * entry shows its country flag instead (see ItemIcon). TODAY/TOMORROW have
 * no sport to derive from, so those use a staff-picked icon from a fixed,
 * consistently-designed generic set instead (see TopNavIcon).
 */
export function SecondaryNavBar() {
  const { data: items } = useTopNavItems();
  const { data: matches } = useMatches();
  const { data: boosts } = useBoosts();
  const { data: specials } = useSpecials();
  const { data: leaderboardCampaigns } = useLeaderboardCampaigns();
  const competitionSports = useMemo(() => competitionSportMap(matches ?? []), [matches]);
  const competitionCountries = useMemo(() => competitionCountryMap(matches ?? []), [matches]);
  const leaderboardCampaignIds = useMemo(
    () => (leaderboardCampaigns ? new Set(leaderboardCampaigns.map((campaign) => campaign.id)) : undefined),
    [leaderboardCampaigns],
  );
  const availability: QuicklinkAvailability = { matches, boosts, specials, leaderboardCampaignIds };
  const visibleItems = (items ?? []).filter((item) => hasContent(item, availability));

  if (visibleItems.length === 0) return null;

  return (
    <nav
      aria-label="Quick links"
      className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-2.5 sm:mx-0 sm:px-0"
      data-horizontal-scroll="true"
    >
      {visibleItems.map((item) => (
        <Link
          key={item.id}
          to={hrefForItem(item, competitionSports)}
          className="tab tab-sm shrink-0"
          aria-label={item.label}
        >
          <ItemIcon item={item} matches={matches} competitionCountries={competitionCountries} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LiveMatchChip } from '../features/odds-board/LiveMatchesStrip';
import { MatchCard } from '../features/odds-board/MatchCard';
import { useLiveScoreboard } from '../features/match-detail/useLiveScoreboard';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { useMatches } from '../features/odds-board/useMatches';
import { useMatchOfTheDay } from '../features/odds-board/useMatchOfTheDay';
import { usePrefetchMatchDetail } from '../features/odds-board/usePrefetchMatchDetail';
import { sortMatches } from '../features/odds-board/sortMatches';
import { MarketSelections } from '../features/bet-slip/MarketSelections';
import { Card } from '../components/ui/Card';
import { HorizontalScroller } from '../components/ui/HorizontalScroller';
import { CalendarIcon, ClockIcon, LiveIcon } from '../components/ui/NavIcons';
import { SportIcon } from '../components/ui/SportIcon';
import { cn } from '../lib/cn';
import { HOURS_WINDOWS, HOURS_WINDOW_LABELS, isWithinHoursWindow, type HoursWindow } from '../lib/hoursWindow';
import { useBrandStore } from '../features/brand/brandStore';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { PromoCardTile } from '../features/promo-cards/PromoCardTile';
import { usePromoCards } from '../features/promo-cards/usePromoCards';
import { useHomepageCarouselConfig } from '../features/promo-cards/useHomepageCarouselConfig';
import { useTeamColors } from '../features/odds-board/useTeamColors';
import { useTeamAcronyms } from '../features/odds-board/useTeamAcronyms';
import { TeamBadge } from '../components/ui/TeamBadge';
import { fallbackTeamColor } from '../lib/fallbackTeamColor';
import { formatKickoff } from '../lib/formatKickoff';
import { sortSportsByPriority } from '../lib/sportPriority';
import { staggerDelay } from '../lib/staggerDelay';
import type { Market, Match } from '@sportsbook/shared';

/** Homepage sections start capped at this many items; Upcoming's own "Load more" reveals more in place, this many at a time (see visibleUpcomingCount). */
const MAX_HOMEPAGE_ITEMS = 10;

function StarIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={props.className}>
      <path d="M10 1.5l2.47 5.77 6.28.55-4.76 4.14 1.42 6.14L10 14.9l-5.41 3.2 1.42-6.14L1.25 7.82l6.28-.55L10 1.5z" />
    </svg>
  );
}

interface FeaturedMatchCardProps {
  match: Match;
  matchResult: Market;
  className?: string;
}

/**
 * The "Match of the day" hero - one card per staff-picked entry (see
 * useMatchOfTheDay/the backoffice's CMS Match of the day page). Never
 * auto-picked; the caller (OddsBoardPage's shared featured-content
 * carousel) decides how many of these to show at once and how.
 *
 * Frames the card with a two-color border built from the listed teams'
 * own colors (home -> away, same duo every regular MatchCard glows with),
 * and an MOTD badge and the two teams as initials-badge rows. The inner
 * surface carries the same blurred team-color glow (`.match-card-glow`)
 * as every other match card,
 * so this hero reads as "a match card, emphasized" rather than a
 * differently-branded one. The full match-result market (not just one
 * promoted odd) sits at the bottom so every price is still one tap away.
 */
function FeaturedMatchCard({ match, matchResult, className }: FeaturedMatchCardProps) {
  const navigate = useNavigate();
  const prefetchMatchDetail = usePrefetchMatchDetail();
  const teamColors = useTeamColors();
  const teamAcronyms = useTeamAcronyms();
  const displayName = useDisplayNames();
  const href = `/matches/${match.id}`;
  const homeTeamLabel = displayName('TEAM', match.homeTeam);
  const awayTeamLabel = displayName('TEAM', match.awayTeam);
  const homeColor = teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam);
  const awayColor = teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam);
  const { data: scoreboard } = useLiveScoreboard();
  const liveState = scoreboard?.[match.id];

  return (
    <div
      className={cn('flex cursor-pointer flex-col rounded-3xl p-[2px] transition-transform hover:scale-[1.005]', className)}
      style={{ background: `linear-gradient(160deg, ${homeColor}, ${awayColor})` }}
      onClick={() => navigate(href)}
      onMouseEnter={() => prefetchMatchDetail(match.id)}
      onTouchStart={() => prefetchMatchDetail(match.id)}
    >
      <section
        className="relative flex flex-1 flex-col overflow-hidden rounded-[22px] bg-surface text-text-primary"
        style={{ '--home-glow': homeColor, '--away-glow': awayColor } as CSSProperties}
      >
        <div className="match-card-glow" aria-hidden="true" />

        {match.isLive && (
          // Corner badge, same treatment as the regular MatchCard - the
          // minute rolls into the badge itself (see useLiveScoreboard)
          // rather than sitting as separate text elsewhere on the card.
          <span className="absolute top-2 right-2 z-20 shrink-0 rounded-full bg-price-down px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
            LIVE{liveState ? ` ${liveState.minute}'` : ''}
          </span>
        )}

        <div className="relative z-10 flex flex-1 flex-col p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white uppercase"
              style={{ backgroundColor: 'var(--color-brand)' }}
            >
              <StarIcon className="h-2.5 w-2.5" />
              Match of the day
            </span>
            <span
              className={`min-w-0 truncate text-[11px] font-bold tracking-wide text-text-muted uppercase ${match.isLive ? 'pr-14' : ''}`}
            >
              {displayName('COMPETITION', match.competition)}
            </span>
          </div>

          <h1
            aria-label={`${homeTeamLabel} vs ${awayTeamLabel}`}
            className="mt-3 flex items-center justify-between gap-3"
          >
            <span className="flex flex-col gap-1.5">
              <span className="flex items-center gap-3">
                <TeamBadge
                  name={homeTeamLabel}
                  colorHex={teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam)}
                  acronym={teamAcronyms.get(match.homeTeam)}
                />
                <Link
                  to={href}
                  className="font-display text-sm leading-tight font-bold hover:underline sm:text-base"
                  onClick={(event) => event.stopPropagation()}
                >
                  {homeTeamLabel}
                </Link>
              </span>
              <span className="flex items-center gap-3">
                <TeamBadge
                  name={awayTeamLabel}
                  colorHex={teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam)}
                  acronym={teamAcronyms.get(match.awayTeam)}
                />
                <Link
                  to={href}
                  className="font-display text-sm leading-tight font-bold hover:underline sm:text-base"
                  onClick={(event) => event.stopPropagation()}
                >
                  {awayTeamLabel}
                </Link>
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1 text-right">
              <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">vs</span>
              {!match.isLive && (
                <span className="text-xs font-bold text-highlight">{formatKickoff(new Date(match.kickoff))}</span>
              )}
            </span>
          </h1>

          {/* Pinned to the card's bottom edge so it lands at a consistent
              height regardless of how much extra room the card has above
              it. */}
          <div className="mt-auto pt-2">
            <p className="mb-1.5 text-[11px] font-bold tracking-wide text-text-muted uppercase">
              {displayName('MARKET', matchResult.name)}
            </p>
            <MarketSelections
              matchId={match.id}
              matchLabel={`${homeTeamLabel} vs ${awayTeamLabel}`}
              competition={match.competition}
              market={matchResult}
              homeTeamLabel={homeTeamLabel}
              awayTeamLabel={awayTeamLabel}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function featuredMatchResultFor(match: Match): Market {
  return match.markets.find((market) => market.id === 'match-result')!;
}

export default function OddsBoardPage() {
  const { data: matches, isPending, isError } = useMatches();
  const { data: motdEntries } = useMatchOfTheDay();
  const { data: promoCards } = usePromoCards();
  const { data: carouselConfig } = useHomepageCarouselConfig();
  const brandId = useBrandStore((state) => state.brandId);
  const displayName = useDisplayNames();
  const [selectedSport, setSelectedSport] = useState<string | undefined>(undefined);
  // Upcoming-section-only ("how soon") filter - Live matches are already
  // happening now, so a kickoff time window doesn't apply to them. Defaults
  // to 'all' with its own row collapsed (see hoursMenuOpen) rather than
  // always taking up a row of its own.
  const [hoursWindow, setHoursWindow] = useState<HoursWindow>('all');
  const [hoursMenuOpen, setHoursMenuOpen] = useState(false);
  // How many Upcoming matches to show - starts capped, grows in place (no
  // navigation) each time "Load more" is clicked, rather than handing off
  // to the full sport page.
  const [visibleUpcomingCount, setVisibleUpcomingCount] = useState(MAX_HOMEPAGE_ITEMS);

  const sorted = matches ? sortMatches(matches, 'time') : undefined;
  // Never auto-picked - only the staff-configured entries that are both
  // currently scheduled-active (see the backend's isCampaignScheduledActive)
  // and still resolve to a live match with a match-result market to show
  // odds for. A pick whose match has since kicked off out of the feed, or
  // never had a match-result market, just silently drops rather than
  // erroring. Order follows the CMS's own sortOrder (already the order
  // motdEntries arrives in). Excluding these from `rest` (used by every
  // other section below) matters just as much as picking them - a featured
  // match staying in the plain Upcoming list too would show it twice.
  const matchById = new Map((sorted ?? []).map((match) => [match.id, match] as const));
  const featuredMatches = (motdEntries ?? [])
    .map((entry) => matchById.get(entry.matchId))
    .filter((match): match is Match => match !== undefined && match.markets.some((market) => market.id === 'match-result'));
  const featuredMatchIds = new Set(featuredMatches.map((match) => match.id));
  const rest = sorted ? sorted.filter((match) => !featuredMatchIds.has(match.id)) : [];

  const liveMatches = rest.filter((match) => match.isLive);
  const upcomingAll = rest.filter((match) => !match.isLive);
  const sportsPresent = sortSportsByPriority(
    Array.from(new Set(upcomingAll.map((match) => match.sport))),
  );
  const effectiveSport =
    selectedSport && sportsPresent.includes(selectedSport) ? selectedSport : sportsPresent[0];
  const upcomingForSport = effectiveSport
    ? upcomingAll.filter((match) => match.sport === effectiveSport)
    : upcomingAll;

  // "How soon" window, layered on top of the sport filter - counts are
  // computed against upcomingForSport so switching sport updates them too,
  // same as the reference's combined sport+time filter.
  const upcomingWindowCounts = Object.fromEntries(
    HOURS_WINDOWS.map((window) => [
      window,
      upcomingForSport.filter((match) => isWithinHoursWindow(window, new Date(match.kickoff))).length,
    ]),
  ) as Record<HoursWindow, number>;
  // An empty window (e.g. nothing kicking off in the next 3h) is a dead
  // option rather than a useful filter - same reasoning as SportPage's own
  // date-bucket tabs.
  const visibleHoursWindows = HOURS_WINDOWS.filter((window) => upcomingWindowCounts[window] > 0);
  const upcomingFiltered = upcomingForSport.filter((match) =>
    isWithinHoursWindow(hoursWindow, new Date(match.kickoff)),
  );

  // Switching sport or kickoff-time window starts the list capped again,
  // rather than carrying over however far a previous "Load more" click
  // expanded it.
  useEffect(() => {
    setVisibleUpcomingCount(MAX_HOMEPAGE_ITEMS);
  }, [effectiveSport, hoursWindow]);

  const liveCapped = liveMatches.slice(0, MAX_HOMEPAGE_ITEMS);
  const upcomingCapped = upcomingFiltered.slice(0, visibleUpcomingCount);

  // The "Challenges" slot next to Match of the day: staff-managed CMS promo
  // cards (see the backoffice's Promo Cards page) when the brand has any,
  // swipeable within itself once there's more than one. With none active,
  // the slot is omitted entirely rather than falling back to fabricated
  // placeholder copy - see CLAUDE.md's "only build what's backed by real
  // data". Only active, imaged cards belong here - a no-image auto-created
  // banner (see PromoCardTile) is a short strip, not a fixed-aspect photo,
  // so it doesn't fit this slot's carousel (it still shows in full on the
  // Challenges page); an early-ended card is a Challenges-page-only concept
  // too.
  const homepagePromoCards = (promoCards ?? []).filter((card) => card.status === 'ACTIVE' && card.hasImage);
  const hasCmsPromoCards = Boolean(homepagePromoCards.length > 0 && brandId);
  function promoSlotItems(className: string) {
    return homepagePromoCards.map((card) => (
      <PromoCardTile key={card.id} card={card} brandId={brandId as string} className={className} />
    ));
  }
  const promoSlotCount = hasCmsPromoCards ? homepagePromoCards.length : 0;
  const autoScrollSeconds =
    carouselConfig?.enabled && carouselConfig.autoScrollSeconds > 0 ? carouselConfig.autoScrollSeconds : undefined;

  return (
    <div>
      {/* Mobile-only: live matches shown inline, right below the header and
          above the carousel, rather than behind a Live/Upcoming tab -
          sections here are never divided by a live-vs-upcoming filter.
          Compact cards (see LiveMatchesStrip's own LiveMatchChip), not the
          full MatchCard desktop's own "Live now" section below uses - a
          full-size card per live match would dominate the limited mobile
          viewport above the fold. */}
      {liveMatches.length > 0 && (
        <div className="mb-4 sm:hidden">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-text-secondary">
            <LiveIcon width={14} height={14} />
            Live now
          </div>
          <div className="scrollbar-hide flex snap-x gap-2 overflow-x-auto pb-1" role="group" aria-label="Live matches">
            {liveCapped.map((match) => (
              <LiveMatchChip key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      {(featuredMatches.length > 0 || hasCmsPromoCards) && (
        <div className="mb-8">
          {/* One shared swipeable/scrollable block mixing every featured
              match and promo card, all the same fixed width - dots show
              there's more than one card, no arrows on mobile (touch swipe
              covers it), overlay arrows on desktop (see HorizontalScroller).
              A fixed width (not full-bleed on mobile, not a percentage on
              desktop) is what makes the next card's edge consistently peek
              in on both, so the row reads as a carousel rather than a
              single card filling whatever space it's given. */}
          <HorizontalScroller
            itemCount={featuredMatches.length + promoSlotCount}
            ariaLabel="Featured content"
            autoScrollSeconds={autoScrollSeconds}
          >
            {featuredMatches.map((match) => (
              <FeaturedMatchCard
                key={match.id}
                match={match}
                matchResult={featuredMatchResultFor(match)}
                className="w-[350px] shrink-0 snap-center"
              />
            ))}
            {promoSlotItems('w-[350px] shrink-0 snap-center')}
          </HorizontalScroller>
        </div>
      )}

      {isPending && <MatchListSkeleton />}
      {isError && <Card className="text-danger">Failed to load matches.</Card>}

      {/* Desktop: the two sections always stack, unfiltered by the mobile
          tab above (which doesn't render at this breakpoint anyway). */}
      <div className="hidden sm:block">
        {liveMatches.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <LiveIcon width={22} height={22} />
              <h2 className="font-display text-lg">Live now</h2>
            </div>
            <HorizontalScroller itemCount={liveCapped.length} ariaLabel="Live matches">
              {liveCapped.map((match, index) => (
                <div key={match.id} className="w-72 shrink-0 snap-start">
                  <MatchCard match={match} style={staggerDelay(index)} />
                </div>
              ))}
            </HorizontalScroller>
            {liveMatches.length > MAX_HOMEPAGE_ITEMS && (
              <Link to="/sports/all" className="btn-ghost mt-3 inline-flex w-auto items-center justify-center">
                Load more
              </Link>
            )}
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center gap-2">
            <CalendarIcon width={22} height={22} />
            <h2 className="font-display text-lg">Upcoming</h2>
          </div>

          <div className="mb-3 flex items-center gap-2">
            {sportsPresent.length > 1 && (
              <div
                className="scrollbar-hide -mx-1 flex flex-1 gap-2 overflow-x-auto p-1"
                role="group"
                aria-label="Filter by sport"
                data-horizontal-scroll="true"
              >
                {sportsPresent.map((sport) => (
                  <button
                    key={sport}
                    type="button"
                    className={`tab shrink-0${sport === effectiveSport ? ' active' : ''}`}
                    aria-pressed={sport === effectiveSport}
                    onClick={() => setSelectedSport(sport)}
                  >
                    <SportIcon sport={sport} size={16} />
                    {displayName('SPORT', sport)}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className={`icon-toggle shrink-0${hoursMenuOpen ? ' active' : ''}`}
              aria-expanded={hoursMenuOpen}
              aria-label="Filter by kickoff time"
              onClick={() => setHoursMenuOpen((open) => !open)}
            >
              <ClockIcon width={16} height={16} />
            </button>
          </div>

          {hoursMenuOpen && (
            <div
              className="scrollbar-hide -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1"
              role="group"
              aria-label="Filter by kickoff time"
              data-horizontal-scroll="true"
            >
              {visibleHoursWindows.map((window) => (
                <button
                  key={window}
                  type="button"
                  className={`tab shrink-0${window === hoursWindow ? ' active' : ''}`}
                  aria-pressed={window === hoursWindow}
                  onClick={() => setHoursWindow(window)}
                >
                  {HOURS_WINDOW_LABELS[window]}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold not-italic tabular-nums ${
                      window === hoursWindow ? 'bg-black/15' : 'bg-black/20'
                    }`}
                  >
                    {upcomingWindowCounts[window]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {sorted && rest.length === 0 && featuredMatches.length === 0 && (
            <Card className="text-text-secondary">No matches available right now.</Card>
          )}
          {upcomingForSport.length > 0 && upcomingFiltered.length === 0 && (
            <Card className="text-text-secondary">No matches kicking off in this window.</Card>
          )}
          {upcomingCapped.length > 0 && (
            <div className="space-y-3">
              {upcomingCapped.map((match, index) => (
                <MatchCard key={match.id} match={match} style={staggerDelay(index)} />
              ))}
            </div>
          )}
          {upcomingFiltered.length > visibleUpcomingCount && (
            <button
              type="button"
              onClick={() => setVisibleUpcomingCount((count) => count + MAX_HOMEPAGE_ITEMS)}
              className="btn-ghost mt-3 inline-flex w-auto items-center justify-center"
            >
              Load more
            </button>
          )}
        </section>
      </div>

      {/* Mobile: sport filters then the upcoming matches list - live matches
          already showed above (see the Live now strip near the top of this
          page), never behind a tab here. */}
      <div className="sm:hidden">
        {sportsPresent.length > 1 && (
          <div className="mb-3 flex items-center gap-2">
            <div
              className="scrollbar-hide -mx-1 flex flex-1 gap-2 overflow-x-auto p-1"
              role="group"
              aria-label="Filter by sport"
              data-horizontal-scroll="true"
            >
              {sportsPresent.map((sport) => (
                <button
                  key={sport}
                  type="button"
                  className={`tab shrink-0${sport === effectiveSport ? ' active' : ''}`}
                  aria-pressed={sport === effectiveSport}
                  onClick={() => setSelectedSport(sport)}
                >
                  <SportIcon sport={sport} size={16} />
                  {displayName('SPORT', sport)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`icon-toggle shrink-0${hoursMenuOpen ? ' active' : ''}`}
              aria-expanded={hoursMenuOpen}
              aria-label="Filter by kickoff time"
              onClick={() => setHoursMenuOpen((open) => !open)}
            >
              <ClockIcon width={16} height={16} />
            </button>
          </div>
        )}

        {sorted && rest.length === 0 && featuredMatches.length === 0 && (
          <Card className="text-text-secondary">No matches available right now.</Card>
        )}

        {hoursMenuOpen && (
          <div
            className="scrollbar-hide -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Filter by kickoff time"
            data-horizontal-scroll="true"
          >
            {visibleHoursWindows.map((window) => (
              <button
                key={window}
                type="button"
                className={`tab shrink-0${window === hoursWindow ? ' active' : ''}`}
                aria-pressed={window === hoursWindow}
                onClick={() => setHoursWindow(window)}
              >
                {HOURS_WINDOW_LABELS[window]}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold not-italic tabular-nums ${
                    window === hoursWindow ? 'bg-black/15' : 'bg-black/20'
                  }`}
                >
                  {upcomingWindowCounts[window]}
                </span>
              </button>
            ))}
          </div>
        )}

        {upcomingForSport.length > 0 && upcomingFiltered.length === 0 && (
          <Card className="text-text-secondary">No matches kicking off in this window.</Card>
        )}
        {upcomingCapped.length > 0 && (
          <div className="space-y-3">
            {upcomingCapped.map((match, index) => (
              <MatchCard key={match.id} match={match} style={staggerDelay(index)} />
            ))}
          </div>
        )}
        {upcomingFiltered.length > visibleUpcomingCount && (
          <button
            type="button"
            onClick={() => setVisibleUpcomingCount((count) => count + MAX_HOMEPAGE_ITEMS)}
            className="btn-ghost mt-3 flex w-full items-center justify-center"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

import { useState, type CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MatchCard } from '../features/odds-board/MatchCard';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { useMatches } from '../features/odds-board/useMatches';
import { usePrefetchMatchDetail } from '../features/odds-board/usePrefetchMatchDetail';
import { sortMatches } from '../features/odds-board/sortMatches';
import { MarketSelections } from '../features/bet-slip/MarketSelections';
import { BrandPromoImage } from '../components/ui/BrandPromoImage';
import { Card } from '../components/ui/Card';
import { HorizontalScroller } from '../components/ui/HorizontalScroller';
import { CalendarIcon, LiveIcon } from '../components/ui/NavIcons';
import { SportIcon } from '../components/ui/SportIcon';
import { cn } from '../lib/cn';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { useBrandStore } from '../features/brand/brandStore';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { PromoCardTile } from '../features/promo-cards/PromoCardTile';
import { usePromoCards } from '../features/promo-cards/usePromoCards';
import { useHomepageCarouselConfig } from '../features/promo-cards/useHomepageCarouselConfig';
import { useTeamColors } from '../features/odds-board/useTeamColors';
import { fallbackTeamColor } from '../lib/fallbackTeamColor';
import { formatKickoff } from '../lib/formatKickoff';
import { sortSportsByPriority } from '../lib/sportPriority';
import { staggerDelay } from '../lib/staggerDelay';
import type { Market, Match } from '@sportsbook/shared';

/** Homepage sections stay short; "Load more" hands off to the full sport page. */
const MAX_HOMEPAGE_ITEMS = 10;

/** "Real Madrid" -> "RM", "Chelsea" -> "CH" - a badge initial when there's no team crest in the data model. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Circular initials badge - fills with the team's admin-assigned color (see Team Colors backoffice) when there is one, a deterministic per-team fallback color otherwise. */
function TeamBadge({ name, colorHex }: { name: string; colorHex: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white sm:h-9 sm:w-9 sm:text-xs"
      style={{ backgroundColor: colorHex }}
    >
      {initials(name)}
    </span>
  );
}

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
 * The "Match of the day" hero. Just one match today (the earliest/live
 * one, computed client-side) - once the backoffice can pin more than one,
 * this is the shape that already supports it, the caller just needs to
 * pass more of them into the HorizontalScroller around it.
 *
 * Frames the card with a two-color border built from the listed teams'
 * own colors (home -> away, same duo every regular MatchCard glows with),
 * plus a thicker left "spine" in the same duo, and an MOTD badge and the
 * two teams as initials-badge rows. The inner surface carries the same
 * blurred team-color glow (`.match-card-glow`) as every other match card,
 * so this hero reads as "a match card, emphasized" rather than a
 * differently-branded one. The full match-result market (not just one
 * promoted odd) sits at the bottom so every price is still one tap away.
 */
function FeaturedMatchCard({ match, matchResult, className }: FeaturedMatchCardProps) {
  const navigate = useNavigate();
  const prefetchMatchDetail = usePrefetchMatchDetail();
  const teamColors = useTeamColors();
  const displayName = useDisplayNames();
  const href = `/matches/${match.id}`;
  const homeTeamLabel = displayName('TEAM', match.homeTeam);
  const awayTeamLabel = displayName('TEAM', match.awayTeam);
  const homeColor = teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam);
  const awayColor = teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam);

  return (
    <div
      className={cn('flex cursor-pointer flex-col rounded-3xl p-[2px] transition-transform hover:scale-[1.005]', className)}
      style={{ background: `linear-gradient(160deg, ${homeColor}, ${awayColor})` }}
      onClick={() => navigate(href)}
      onMouseEnter={() => prefetchMatchDetail(match.id)}
      onTouchStart={() => prefetchMatchDetail(match.id)}
    >
      <section
        className="relative flex flex-1 flex-col overflow-hidden rounded-[22px] bg-surface pl-3.5 text-text-primary"
        style={{ '--home-glow': homeColor, '--away-glow': awayColor } as CSSProperties}
      >
        <div className="match-card-glow" aria-hidden="true" />
        {/* The thicker accent along the left edge, distinct from the thin
            gradient border the outer wrapper's padding creates. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1.5 rounded-l-[inherit]"
          style={{ background: `linear-gradient(180deg, ${homeColor}, ${awayColor})` }}
        />

        <div className="relative z-10 flex flex-1 flex-col p-5">
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide text-white uppercase"
              style={{ backgroundColor: 'var(--color-brand)' }}
            >
              <StarIcon className="h-3 w-3" />
              Match of the day
            </span>
            <span className="text-xs font-bold tracking-wide text-text-muted uppercase">
              {displayName('COMPETITION', match.competition)}
            </span>
          </div>

          <div className="my-4 border-t border-border" />

          <h1
            aria-label={`${homeTeamLabel} vs ${awayTeamLabel}`}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex flex-col gap-3">
              <span className="flex items-center gap-3">
                <TeamBadge name={homeTeamLabel} colorHex={teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam)} />
                <Link
                  to={href}
                  className="font-display text-base leading-tight font-bold hover:underline sm:text-lg"
                  onClick={(event) => event.stopPropagation()}
                >
                  {homeTeamLabel}
                </Link>
              </span>
              <span className="flex items-center gap-3">
                <TeamBadge name={awayTeamLabel} colorHex={teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam)} />
                <Link
                  to={href}
                  className="font-display text-base leading-tight font-bold hover:underline sm:text-lg"
                  onClick={(event) => event.stopPropagation()}
                >
                  {awayTeamLabel}
                </Link>
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1.5 text-right">
              <span className="text-xs font-bold tracking-wide text-text-muted uppercase">vs</span>
              {match.isLive ? (
                <span className="rounded-full bg-price-down px-2 py-0.5 text-[10px] font-extrabold text-white">
                  LIVE
                </span>
              ) : (
                <span className="text-sm font-bold text-highlight">{formatKickoff(new Date(match.kickoff))}</span>
              )}
            </span>
          </h1>

          <div className="my-4 border-t border-border" />

          {/* Pinned to the card's bottom edge so it lands at a consistent
              height regardless of how much extra room the card has above
              it. */}
          <div className="mt-auto">
            <p className="mb-2 text-xs font-bold tracking-wide text-text-muted uppercase">
              {displayName('MARKET', matchResult.name)}
            </p>
            <MarketSelections
              matchId={match.id}
              matchLabel={`${homeTeamLabel} vs ${awayTeamLabel}`}
              competition={match.competition}
              market={matchResult}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Desktop only, next to the featured match - copy/CTA are always shown (the
 * "Claim now" link is real, working navigation, not decorative), with a
 * staff-uploaded HOMEPAGE_OFFER CMS image as the backdrop once one's set
 * (see the backoffice's CMS images page), falling back to a mocked
 * welcome-bonus gradient otherwise.
 */
function PromoCard({ className }: { className?: string }) {
  const brandId = useBrandStore((state) => state.brandId);
  const openAuthModal = useAuthModalStore((state) => state.open);

  return (
    <aside className={cn('relative overflow-hidden rounded-3xl', className)}>
      <BrandPromoImage
        brandId={brandId}
        slot="HOMEPAGE_OFFER"
        className="absolute inset-0 h-full w-full object-cover"
        fallback={
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(155deg, color-mix(in srgb, var(--color-highlight) 80%, black) 0%, color-mix(in srgb, var(--color-highlight) 25%, black) 55%, #0a0a10 100%)',
            }}
          />
        }
      />
      {/* Scrim so the text stays legible over a real (possibly light) photo, not just the mocked gradient which is already dark at this edge. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="relative flex h-full flex-col justify-end gap-2 p-6 text-white">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm">
          Welcome Bonus
        </span>
        <p className="font-display text-2xl leading-tight">Get up to 50 € in bonus bets</p>
        <p className="text-sm text-white/80">Sign up and place your first bet on us.</p>
        <button type="button" onClick={() => openAuthModal('register')} className="btn-primary mt-2 w-fit">
          Claim now
        </button>
      </div>
    </aside>
  );
}

export default function OddsBoardPage() {
  const { data: matches, isPending, isError } = useMatches();
  const { data: promoCards } = usePromoCards();
  const { data: carouselConfig } = useHomepageCarouselConfig();
  const brandId = useBrandStore((state) => state.brandId);
  const displayName = useDisplayNames();
  const [selectedSport, setSelectedSport] = useState<string | undefined>(undefined);
  // Mobile-only content-type toggle (see the tab-pill row rendered right
  // below the header) - desktop keeps its own always-visible Live now +
  // Upcoming stacked sections instead, so this only matters below `sm`.
  const [mobileTab, setMobileTab] = useState<'live' | 'upcoming'>('upcoming');

  const sorted = matches ? sortMatches(matches, 'time') : undefined;
  // The earliest-kickoff match only becomes "featured" if it actually has a
  // match-result market to show odds for - a match with only special/manual
  // markets (or one odds-engine hasn't priced yet) falls through to the
  // next-earliest one instead. Finding the index (rather than always taking
  // [0]) matters just as much for `rest`: excluding a fixed [0] regardless
  // of whether the featured card actually renders was silently dropping
  // that match everywhere, including from the plain Upcoming list.
  const featuredIndex = sorted?.findIndex((match) => match.markets.some((market) => market.id === 'match-result')) ?? -1;
  const featured = featuredIndex >= 0 ? sorted![featuredIndex] : undefined;
  const rest = sorted ? sorted.filter((_, index) => index !== featuredIndex) : [];
  const featuredMatchResult = featured?.markets.find((market) => market.id === 'match-result');

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
  // Mobile's unified tab view extends the same sport filter to live matches
  // too (desktop's separate Live now section stays unfiltered, unchanged).
  const liveForSport = effectiveSport ? liveMatches.filter((match) => match.sport === effectiveSport) : liveMatches;

  const liveCapped = liveMatches.slice(0, MAX_HOMEPAGE_ITEMS);
  const upcomingCapped = upcomingForSport.slice(0, MAX_HOMEPAGE_ITEMS);
  const liveForSportCapped = liveForSport.slice(0, MAX_HOMEPAGE_ITEMS);

  // The "Challenges" slot next to Match of the day: staff-managed CMS promo
  // cards (see the backoffice's Promo Cards page) when the brand has any,
  // otherwise the static Welcome Bonus card that's always been there - the
  // slot itself never disappears or moves, it's swipeable within itself
  // once there's more than one real card. Only active, imaged cards belong
  // here - a no-image auto-created banner (see PromoCardTile) is a short
  // strip, not a fixed-aspect photo, so it doesn't fit this slot's carousel
  // (it still shows in full on the Challenges page); an early-ended card
  // is a Challenges-page-only concept too.
  const homepagePromoCards = (promoCards ?? []).filter((card) => card.status === 'ACTIVE' && card.hasImage);
  const hasCmsPromoCards = Boolean(homepagePromoCards.length > 0 && brandId);
  function promoSlotItems(className: string) {
    if (hasCmsPromoCards) {
      return homepagePromoCards.map((card) => (
        <PromoCardTile key={card.id} card={card} brandId={brandId as string} className={className} />
      ));
    }
    return [<PromoCard key="static-welcome-bonus" className={className} />];
  }
  const promoSlotCount = hasCmsPromoCards ? homepagePromoCards.length : 1;
  const autoScrollSeconds =
    carouselConfig?.enabled && carouselConfig.autoScrollSeconds > 0 ? carouselConfig.autoScrollSeconds : undefined;

  return (
    <div>
      {/* Mobile-only: content-type filter, right below the header and
          above the carousel - desktop keeps its own always-visible Live
          now + Upcoming sections further down instead. Only worth showing
          when there's actually a live match to switch to. */}
      {liveMatches.length > 0 && (
        // The breakpoint utility lives on a plain wrapper, not directly on
        // the .tab-pill element - .tab-pill is unlayered custom CSS (see
        // index.css), which always outranks Tailwind's @layer-scoped
        // `sm:hidden` on the same element regardless of viewport, so
        // combining them there would never actually hide it on desktop.
        <div className="sm:hidden">
          <div className="tab-pill mb-4" role="tablist" aria-label="Match list filter">
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'live'}
              className={`tab-pill-btn${mobileTab === 'live' ? ' active' : ''}`}
              onClick={() => setMobileTab('live')}
            >
              Live
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'upcoming'}
              className={`tab-pill-btn${mobileTab === 'upcoming' ? ' active' : ''}`}
              onClick={() => setMobileTab('upcoming')}
            >
              Upcoming
            </button>
          </div>
        </div>
      )}

      {featured && featuredMatchResult && (
        <div className="mb-8">
          {/* Mobile: one swipeable block mixing the featured match and
              promo cards, all the same size - dots show there's more than
              one card, no arrows (touch swipe covers it). */}
          <div className="sm:hidden">
            <HorizontalScroller
              itemCount={1 + promoSlotCount}
              ariaLabel="Featured content"
              autoScrollSeconds={autoScrollSeconds}
            >
              <FeaturedMatchCard
                match={featured}
                matchResult={featuredMatchResult}
                className="w-full shrink-0 snap-center"
              />
              {promoSlotItems('w-full shrink-0 snap-center')}
            </HorizontalScroller>
          </div>

          {/* Desktop: two separate blocks side by side, each its own
              scroller - the match of the day block only ever scrolls
              between match-of-the-day cards, the promo block only between
              promo cards. Arrows/dots appear automatically once either
              block has more than one card to move between. */}
          <div className="hidden gap-4 sm:flex sm:items-stretch">
            <div className="min-w-0 sm:flex-1">
              <HorizontalScroller itemCount={1} ariaLabel="Match of the day" className="min-w-0">
                <FeaturedMatchCard
                  match={featured}
                  matchResult={featuredMatchResult}
                  className="h-full w-full shrink-0 snap-start"
                />
              </HorizontalScroller>
            </div>
            <div className="min-w-0 sm:w-72 sm:shrink-0">
              <HorizontalScroller
                itemCount={promoSlotCount}
                ariaLabel="Challenges"
                className="min-w-0"
                autoScrollSeconds={autoScrollSeconds}
              >
                {promoSlotItems('h-full w-full shrink-0 snap-start')}
              </HorizontalScroller>
            </div>
          </div>
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

          {sportsPresent.length > 1 && (
            <div
              className="scrollbar-hide -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1"
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

          {sorted && rest.length === 0 && !featured && (
            <Card className="text-text-secondary">No matches available right now.</Card>
          )}
          {upcomingCapped.length > 0 && (
            <div className="space-y-3">
              {upcomingCapped.map((match, index) => (
                <MatchCard key={match.id} match={match} style={staggerDelay(index)} />
              ))}
            </div>
          )}
          {upcomingForSport.length > MAX_HOMEPAGE_ITEMS && effectiveSport && (
            <Link
              to={`/sports/${encodeURIComponent(effectiveSport)}`}
              className="btn-ghost mt-3 inline-flex w-auto items-center justify-center"
            >
              Load more
            </Link>
          )}
        </section>
      </div>

      {/* Mobile: sport filters then a single tab-driven matches list, per
          the requested order (filters, carousel, sport filters, matches). */}
      <div className="sm:hidden">
        {sportsPresent.length > 1 && (
          <div
            className="scrollbar-hide -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1"
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

        {sorted && rest.length === 0 && !featured && (
          <Card className="text-text-secondary">No matches available right now.</Card>
        )}

        {mobileTab === 'live' ? (
          <>
            {liveForSportCapped.length > 0 ? (
              <div className="space-y-3">
                {liveForSportCapped.map((match, index) => (
                  <MatchCard key={match.id} match={match} style={staggerDelay(index)} />
                ))}
              </div>
            ) : (
              liveMatches.length > 0 && <Card className="text-text-secondary">No live matches for this sport right now.</Card>
            )}
            {liveMatches.length > MAX_HOMEPAGE_ITEMS && (
              <Link to="/sports/all" className="btn-ghost mt-3 flex w-full items-center justify-center">
                Load more
              </Link>
            )}
          </>
        ) : (
          <>
            {upcomingCapped.length > 0 && (
              <div className="space-y-3">
                {upcomingCapped.map((match, index) => (
                  <MatchCard key={match.id} match={match} style={staggerDelay(index)} />
                ))}
              </div>
            )}
            {upcomingForSport.length > MAX_HOMEPAGE_ITEMS && effectiveSport && (
              <Link
                to={`/sports/${encodeURIComponent(effectiveSport)}`}
                className="btn-ghost mt-3 flex w-full items-center justify-center"
              >
                Load more
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

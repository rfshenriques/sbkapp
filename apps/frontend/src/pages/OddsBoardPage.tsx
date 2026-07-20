import { useState } from 'react';
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
import { SportIcon } from '../components/ui/SportIcon';
import { cn } from '../lib/cn';
import { useBrandStore } from '../features/brand/brandStore';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { useTeamColors } from '../features/odds-board/useTeamColors';
import { formatKickoff } from '../lib/formatKickoff';
import { sortSportsByPriority } from '../lib/sportPriority';
import type { Market, Match } from '@sportsbook/shared';

/** Homepage sections stay short; "Load more" hands off to the full sport page. */
const MAX_HOMEPAGE_ITEMS = 10;

/** "Real Madrid" -> "RM", "Chelsea" -> "CH" - a badge initial when there's no team crest in the data model. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Circular initials badge - fills with the team's admin-assigned color (see Team Colors backoffice) when there is one, a neutral surface otherwise rather than guessing one. */
function TeamBadge({ name, colorHex }: { name: string; colorHex: string | undefined }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white sm:h-9 sm:w-9 sm:text-xs',
        !colorHex && 'bg-surface-2',
      )}
      style={colorHex ? { backgroundColor: colorHex } : undefined}
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
 * A gradient (--color-brand -> --color-highlight) frames the card as a
 * thin border plus a thicker left "spine", with an MOTD badge and the two
 * teams as initials-badge rows - stays brand-neutral by building the duo
 * tone from the two colors every brand already configures, rather than a
 * fixed red/gold. The full match-result market (not just one promoted
 * odd) sits at the bottom so every price is still one tap away.
 */
function FeaturedMatchCard({ match, matchResult, className }: FeaturedMatchCardProps) {
  const navigate = useNavigate();
  const prefetchMatchDetail = usePrefetchMatchDetail();
  const teamColors = useTeamColors();
  const displayName = useDisplayNames();
  const href = `/matches/${match.id}`;
  const homeTeamLabel = displayName('TEAM', match.homeTeam);
  const awayTeamLabel = displayName('TEAM', match.awayTeam);

  return (
    <div
      className={cn('flex cursor-pointer flex-col rounded-3xl p-[2px] transition-transform hover:scale-[1.005]', className)}
      style={{ background: 'linear-gradient(160deg, var(--color-brand), var(--color-highlight))' }}
      onClick={() => navigate(href)}
      onMouseEnter={() => prefetchMatchDetail(match.id)}
      onTouchStart={() => prefetchMatchDetail(match.id)}
    >
      <section className="relative flex flex-1 flex-col overflow-hidden rounded-[22px] bg-surface pl-3.5 text-text-primary">
        {/* The thicker accent along the left edge, distinct from the thin
            gradient border the outer wrapper's padding creates. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1.5 rounded-l-[inherit]"
          style={{ background: 'linear-gradient(180deg, var(--color-brand), var(--color-highlight))' }}
        />

        <div className="relative flex flex-1 flex-col p-5">
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
                <TeamBadge name={homeTeamLabel} colorHex={teamColors.get(match.homeTeam)} />
                <Link
                  to={href}
                  className="font-display text-base leading-tight font-bold hover:underline sm:text-lg"
                  onClick={(event) => event.stopPropagation()}
                >
                  {homeTeamLabel}
                </Link>
              </span>
              <span className="flex items-center gap-3">
                <TeamBadge name={awayTeamLabel} colorHex={teamColors.get(match.awayTeam)} />
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
        <p className="font-display text-2xl leading-tight">Get up to €50 in bonus bets</p>
        <p className="text-sm text-white/80">Sign up and place your first bet on us.</p>
        <Link to="/register" className="btn-primary mt-2 w-fit">
          Claim now
        </Link>
      </div>
    </aside>
  );
}

export default function OddsBoardPage() {
  const { data: matches, isPending, isError } = useMatches();
  const displayName = useDisplayNames();
  const [selectedSport, setSelectedSport] = useState<string | undefined>(undefined);

  const sorted = matches ? sortMatches(matches, 'time') : undefined;
  const featured = sorted?.[0];
  const rest = sorted?.slice(1) ?? [];
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

  const liveCapped = liveMatches.slice(0, MAX_HOMEPAGE_ITEMS);
  const upcomingCapped = upcomingForSport.slice(0, MAX_HOMEPAGE_ITEMS);

  return (
    <div>
      {featured && featuredMatchResult && (
        <div className="mb-8">
          {/* Mobile: one swipeable block mixing the featured match and
              promo cards, both the same size - dots show there's a second
              card, no arrows (touch swipe covers it). */}
          <div className="sm:hidden">
            <HorizontalScroller itemCount={2} ariaLabel="Featured content">
              <FeaturedMatchCard
                match={featured}
                matchResult={featuredMatchResult}
                className="w-full shrink-0 snap-center"
              />
              <PromoCard className="w-full shrink-0 snap-center" />
            </HorizontalScroller>
          </div>

          {/* Desktop: two separate blocks side by side, each its own
              scroller - the match of the day block only ever scrolls
              between match-of-the-day cards, the promo block only between
              promo cards. Each has exactly one card today, so neither
              shows arrows/dots yet - both appear automatically once
              there's more than one to move between. */}
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
              <HorizontalScroller itemCount={1} ariaLabel="Promotions" className="min-w-0">
                <PromoCard className="h-full w-full shrink-0 snap-start" />
              </HorizontalScroller>
            </div>
          </div>
        </div>
      )}

      {isPending && <MatchListSkeleton />}
      {isError && <Card className="text-danger">Failed to load matches.</Card>}

      {liveMatches.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="brand-flag" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <h2 className="font-display text-lg">Live now</h2>
          </div>
          <HorizontalScroller itemCount={liveCapped.length} ariaLabel="Live matches">
            {liveCapped.map((match) => (
              <div key={match.id} className="w-72 shrink-0 snap-start">
                <MatchCard match={match} />
              </div>
            ))}
          </HorizontalScroller>
          {liveMatches.length > MAX_HOMEPAGE_ITEMS && (
            <Link
              to="/sports/all"
              className="btn-ghost mt-3 flex w-full items-center justify-center sm:inline-flex sm:w-auto"
            >
              Load more
            </Link>
          )}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="brand-flag" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
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
            {upcomingCapped.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
        {upcomingForSport.length > MAX_HOMEPAGE_ITEMS && effectiveSport && (
          <Link
            to={`/sports/${encodeURIComponent(effectiveSport)}`}
            className="btn-ghost mt-3 flex w-full items-center justify-center sm:inline-flex sm:w-auto"
          >
            Load more
          </Link>
        )}
      </section>
    </div>
  );
}

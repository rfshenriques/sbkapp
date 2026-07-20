import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MatchCard } from '../features/odds-board/MatchCard';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { useMatches } from '../features/odds-board/useMatches';
import { usePrefetchMatchDetail } from '../features/odds-board/usePrefetchMatchDetail';
import { sortMatches } from '../features/odds-board/sortMatches';
import { MarketSelections } from '../features/bet-slip/MarketSelections';
import { Card } from '../components/ui/Card';
import { HorizontalScroller } from '../components/ui/HorizontalScroller';
import { SportCountryBadge } from '../components/ui/SportCountryBadge';
import { SportIcon } from '../components/ui/SportIcon';
import { TeamColorAccent } from '../components/ui/TeamColorAccent';
import { cn } from '../lib/cn';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { useTeamColors } from '../features/odds-board/useTeamColors';
import { formatKickoff } from '../lib/formatKickoff';
import { sortSportsByPriority } from '../lib/sportPriority';
import type { Market, Match } from '@sportsbook/shared';

/** Homepage sections stay short; "Load more" hands off to the full sport page. */
const MAX_HOMEPAGE_ITEMS = 10;

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
    <section
      className={cn(
        'relative cursor-pointer overflow-hidden rounded-3xl p-6 pb-5 text-white transition-transform hover:scale-[1.005]',
        className,
      )}
      style={{
        background:
          'linear-gradient(155deg, color-mix(in srgb, var(--color-brand) 85%, black) 0%, color-mix(in srgb, var(--color-brand) 30%, black) 48%, #0a0a10 100%)',
      }}
      onClick={() => navigate(href)}
      onMouseEnter={() => prefetchMatchDetail(match.id)}
      onTouchStart={() => prefetchMatchDetail(match.id)}
    >
      {/* Oversized sport-icon watermark - purely decorative, no real
          match photo exists in our data model so this stands in for it. */}
      <div className="pointer-events-none absolute -right-8 -bottom-10 opacity-15" aria-hidden="true">
        <SportIcon sport={match.sport} size={200} />
      </div>

      <div className="relative">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-highlight backdrop-blur-sm">
          <span className="h-[3px] w-4 -skew-x-[24deg] bg-highlight" aria-hidden="true" />
          Match of the day
        </span>

        <p className="flex items-center gap-2 text-xs font-semibold text-white/70">
          <SportCountryBadge sport={match.sport} country={match.country} />
          <span>{displayName('COMPETITION', match.competition)}</span>
          {match.isLive ? (
            <span className="ml-auto rounded-full bg-price-down px-2 py-0.5 text-[10px] font-extrabold text-white">
              LIVE
            </span>
          ) : (
            <span className="ml-auto text-highlight">{formatKickoff(new Date(match.kickoff))}</span>
          )}
        </p>

        {/* Real link kept for keyboard/screen-reader navigation - the
            section's onClick above is a mouse/touch convenience that
            enlarges the clickable area to the whole card. */}
        <h1
          aria-label={`${homeTeamLabel} vs ${awayTeamLabel}`}
          className="mt-3 flex items-center justify-center gap-3 sm:gap-5"
        >
          <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <TeamColorAccent colorHex={teamColors.get(match.homeTeam)} className="h-4 sm:h-6" />
            <Link
              to={href}
              className="min-w-0 truncate text-right font-display text-xl leading-tight hover:underline sm:text-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              {homeTeamLabel}
            </Link>
          </span>
          <span className="shrink-0 font-display text-sm text-text-muted sm:text-base">vs</span>
          <span className="flex min-w-0 flex-1 items-center justify-start gap-2">
            <Link
              to={href}
              className="min-w-0 truncate text-left font-display text-xl leading-tight hover:underline sm:text-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              {awayTeamLabel}
            </Link>
            <TeamColorAccent colorHex={teamColors.get(match.awayTeam)} className="h-4 sm:h-6" />
          </span>
        </h1>

        <div className="mt-5 max-w-md">
          <MarketSelections
            matchId={match.id}
            matchLabel={`${homeTeamLabel} vs ${awayTeamLabel}`}
            market={matchResult}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Desktop only, next to the featured match - a placeholder for a promo
 * that will become brand-configurable in the backoffice (image/copy/CTA
 * per brand). Mocked here as a welcome-bonus card since there's no
 * PromotionModule yet to back it with real data.
 */
function PromoCard({ className }: { className?: string }) {
  return (
    <aside className={cn('relative overflow-hidden rounded-3xl', className)}>
      <div
        className="flex h-full flex-col justify-end gap-2 p-6 text-white"
        style={{
          background:
            'linear-gradient(155deg, color-mix(in srgb, var(--color-highlight) 80%, black) 0%, color-mix(in srgb, var(--color-highlight) 25%, black) 55%, #0a0a10 100%)',
        }}
      >
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

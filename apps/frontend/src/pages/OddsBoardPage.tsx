import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MatchCard } from '../features/odds-board/MatchCard';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { useMatches } from '../features/odds-board/useMatches';
import { usePrefetchMatchDetail } from '../features/odds-board/usePrefetchMatchDetail';
import { sortMatches } from '../features/odds-board/sortMatches';
import { MarketSelections } from '../features/bet-slip/MarketSelections';
import { Card } from '../components/ui/Card';
import { SportCountryBadge } from '../components/ui/SportCountryBadge';
import { SportIcon } from '../components/ui/SportIcon';
import { TeamColorAccent } from '../components/ui/TeamColorAccent';
import { useTeamColors } from '../features/odds-board/useTeamColors';
import { formatKickoff } from '../lib/formatKickoff';
import { sortSportsByPriority } from '../lib/sportPriority';

/** Homepage sections stay short; "Load more" hands off to the full sport page. */
const MAX_HOMEPAGE_ITEMS = 10;

export default function OddsBoardPage() {
  const { data: matches, isPending, isError } = useMatches();
  const navigate = useNavigate();
  const prefetchMatchDetail = usePrefetchMatchDetail();
  const teamColors = useTeamColors();
  const [selectedSport, setSelectedSport] = useState<string | undefined>(undefined);

  const sorted = matches ? sortMatches(matches, 'time') : undefined;
  const featured = sorted?.[0];
  const rest = sorted?.slice(1) ?? [];
  const featuredMatchResult = featured?.markets.find((market) => market.id === 'match-result');
  const featuredHref = featured ? `/matches/${featured.id}` : undefined;

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
      {featured && featuredMatchResult && featuredHref && (
        <section
          className="relative mb-8 cursor-pointer overflow-hidden rounded-2xl p-6 pb-5 text-white transition-transform hover:scale-[1.005]"
          style={{
            background:
              'linear-gradient(155deg, color-mix(in srgb, var(--color-brand) 85%, black) 0%, color-mix(in srgb, var(--color-brand) 30%, black) 48%, #0a0a10 100%)',
          }}
          onClick={() => navigate(featuredHref)}
          onMouseEnter={() => prefetchMatchDetail(featured.id)}
          onTouchStart={() => prefetchMatchDetail(featured.id)}
        >
          {/* Oversized sport-icon watermark - purely decorative, no real
              match photo exists in our data model so this stands in for it. */}
          <div className="pointer-events-none absolute -right-8 -bottom-10 opacity-15" aria-hidden="true">
            <SportIcon sport={featured.sport} size={200} />
          </div>

          <div className="relative">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-highlight backdrop-blur-sm">
              <span className="h-[3px] w-4 -skew-x-[24deg] bg-highlight" aria-hidden="true" />
              Match of the day
            </span>

            <p className="flex items-center gap-2 text-xs font-semibold text-white/70">
              <SportCountryBadge sport={featured.sport} country={featured.country} />
              <span>{featured.competition}</span>
              {featured.isLive ? (
                <span className="slash ml-auto bg-price-down px-2 py-0.5 text-[10px] font-extrabold text-white">
                  LIVE
                </span>
              ) : (
                <span className="ml-auto text-highlight">{formatKickoff(new Date(featured.kickoff))}</span>
              )}
            </p>

            {/* Real link kept for keyboard/screen-reader navigation - the
                section's onClick above is a mouse/touch convenience that
                enlarges the clickable area to the whole card. */}
            <h1
              aria-label={`${featured.homeTeam} vs ${featured.awayTeam}`}
              className="mt-3 flex items-center justify-center gap-3 sm:gap-5"
            >
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <TeamColorAccent colorHex={teamColors.get(featured.homeTeam)} className="h-4 sm:h-6" />
                <Link
                  to={featuredHref}
                  className="min-w-0 truncate text-right font-display text-xl leading-tight hover:underline sm:text-3xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  {featured.homeTeam}
                </Link>
              </span>
              <span className="shrink-0 font-display text-sm text-white/50 sm:text-base">vs</span>
              <span className="flex min-w-0 flex-1 items-center justify-start gap-2">
                <Link
                  to={featuredHref}
                  className="min-w-0 truncate text-left font-display text-xl leading-tight hover:underline sm:text-3xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  {featured.awayTeam}
                </Link>
                <TeamColorAccent colorHex={teamColors.get(featured.awayTeam)} className="h-4 sm:h-6" />
              </span>
            </h1>

            <div className="mt-5 max-w-md">
              <MarketSelections
                matchId={featured.id}
                matchLabel={`${featured.homeTeam} vs ${featured.awayTeam}`}
                market={featuredMatchResult}
              />
            </div>
          </div>
        </section>
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
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
            {liveCapped.map((match) => (
              <div key={match.id} className="w-72 shrink-0 snap-start">
                <MatchCard match={match} />
              </div>
            ))}
          </div>
          {liveMatches.length > MAX_HOMEPAGE_ITEMS && (
            <Link to="/sports/all" className="btn-ghost slash mt-3 inline-flex items-center justify-center">
              Load more live matches →
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
            className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Filter by sport"
          >
            {sportsPresent.map((sport) => (
              <button
                key={sport}
                type="button"
                className={`slash tab shrink-0${sport === effectiveSport ? ' active' : ''}`}
                aria-pressed={sport === effectiveSport}
                onClick={() => setSelectedSport(sport)}
              >
                <SportIcon sport={sport} size={16} />
                {sport}
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
            className="btn-ghost slash mt-3 inline-flex items-center justify-center"
          >
            Load more {effectiveSport} matches →
          </Link>
        )}
      </section>
    </div>
  );
}

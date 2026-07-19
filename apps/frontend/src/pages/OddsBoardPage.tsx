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
import { formatKickoff } from '../lib/formatKickoff';
import { sortSportsByPriority } from '../lib/sportPriority';

/** Homepage sections stay short; "Load more" hands off to the full sport page. */
const MAX_HOMEPAGE_ITEMS = 10;

export default function OddsBoardPage() {
  const { data: matches, isPending, isError } = useMatches();
  const navigate = useNavigate();
  const prefetchMatchDetail = usePrefetchMatchDetail();
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
          className="relative mb-8 cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-text-muted"
          onClick={() => navigate(featuredHref)}
          onMouseEnter={() => prefetchMatchDetail(featured.id)}
          onTouchStart={() => prefetchMatchDetail(featured.id)}
        >
          <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-highlight">
            <span className="h-[3px] w-6 -skew-x-[24deg] bg-brand" aria-hidden="true" />
            Match of the day
          </span>
          {/* Real link kept for keyboard/screen-reader navigation - the
              section's onClick above is a mouse/touch convenience that
              enlarges the clickable area to the whole card. */}
          <h1 className="font-display text-4xl leading-none sm:text-5xl">
            <Link
              to={featuredHref}
              className="hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {featured.homeTeam} vs {featured.awayTeam}
            </Link>
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
            <SportCountryBadge sport={featured.sport} country={featured.country} />
            <span>{featured.competition}</span>
            {!featured.isLive && (
              <span className="ml-auto">{formatKickoff(new Date(featured.kickoff))}</span>
            )}
          </p>
          <div className="mt-4 max-w-md">
            <MarketSelections
              matchId={featured.id}
              matchLabel={`${featured.homeTeam} vs ${featured.awayTeam}`}
              market={featuredMatchResult}
            />
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
            <h2 className="font-display text-xl">Live now</h2>
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
          <h2 className="font-display text-xl">Upcoming</h2>
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

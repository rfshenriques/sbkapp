import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { MatchCard } from '../features/odds-board/MatchCard';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { useMatches } from '../features/odds-board/useMatches';
import { useCompetitionRankings } from '../features/odds-board/useCompetitionRankings';
import { rankMapFromRankings, sortMatches, type MatchSortMode } from '../features/odds-board/sortMatches';
import { buildSportTree } from '../features/navigation/buildSportTree';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { BackButton } from '../components/ui/BackButton';
import { Breadcrumb, type BreadcrumbSegment } from '../components/ui/Breadcrumb';
import { Card } from '../components/ui/Card';
import { SportIcon } from '../components/ui/SportIcon';
import { sortSportsByPriority } from '../lib/sportPriority';
import { staggerDelay } from '../lib/staggerDelay';

/** "all" shows every sport unfiltered - used by the homepage's "Live now" load-more, which isn't scoped to one sport. */
const ALL_SPORTS = 'all';

/** Same load-more pattern as the homepage, just a bigger first page - this is the dedicated "see everything" view, not a short teaser section. */
const PAGE_SIZE = 20;

export default function SportPage() {
  const { sport } = useParams<{ sport: string }>();
  const decodedSport = sport ? decodeURIComponent(sport) : ALL_SPORTS;
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const competitionFilter = searchParams.get('competition');
  const countryFilter = searchParams.get('country');
  const liveOnly = location.pathname === '/live' || searchParams.get('live') === 'true';
  const [sortMode, setSortMode] = useState<MatchSortMode>('time');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Only meaningful in the "all sports" umbrella views (/live, /sports/all)
  // - a single-sport page (/sports/Football) already has exactly one sport,
  // narrowed further by its own country/competition breadcrumb instead.
  const [selectedSport, setSelectedSport] = useState<string | undefined>(undefined);

  const { data: matches, isPending, isError } = useMatches();
  const { data: rankings } = useCompetitionRankings();
  const rankByCompetition = useMemo(() => rankMapFromRankings(rankings ?? []), [rankings]);
  const displayName = useDisplayNames();

  // Scoped by everything except the sport chip row itself, so the chips can
  // show every sport actually present in this view (e.g. every sport with a
  // live match right now) rather than shrinking to just whichever one is
  // currently selected.
  const scopedBeforeSportFilter = matches?.filter(
    (match) =>
      (!countryFilter || match.country === countryFilter) &&
      (!competitionFilter || match.competition === competitionFilter) &&
      (!liveOnly || match.isLive),
  );
  const sportsPresent =
    decodedSport === ALL_SPORTS
      ? sortSportsByPriority(Array.from(new Set((scopedBeforeSportFilter ?? []).map((match) => match.sport))))
      : [];
  const filtered = scopedBeforeSportFilter?.filter((match) =>
    decodedSport === ALL_SPORTS ? !selectedSport || match.sport === selectedSport : match.sport === decodedSport,
  );
  const sorted = filtered ? sortMatches(filtered, sortMode, rankByCompetition) : undefined;
  const visible = sorted?.slice(0, visibleCount);

  // A different filter/sort is a different list - start each one back at
  // the first page rather than carrying over however far the player had
  // scrolled through the previous view.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [decodedSport, competitionFilter, countryFilter, liveOnly, sortMode, selectedSport]);
  const heading = competitionFilter
    ? displayName('COMPETITION', competitionFilter)
    : liveOnly
      ? 'Live'
      : decodedSport === ALL_SPORTS
        ? 'All matches'
        : displayName('SPORT', decodedSport);

  // Only a real sport (not the "all"/"live" umbrella views) has a
  // country/competition hierarchy worth letting the player jump around in.
  const showHierarchyBreadcrumb = decodedSport !== ALL_SPORTS && !liveOnly;
  const sportNode = useMemo(
    () => buildSportTree(matches ?? [], rankByCompetition),
    [matches, rankByCompetition],
  ).find((node) => node.sport === decodedSport);
  const explicitCountry =
    countryFilter ??
    (competitionFilter ? matches?.find((match) => match.competition === competitionFilter)?.country : undefined);
  // A sport with only one country has nothing to switch between, so treat it as implicitly selected without needing a country param in the URL.
  const activeCountry =
    explicitCountry ?? (sportNode?.countries.length === 1 ? sportNode.countries[0]?.country : undefined);
  const activeCountryNode = sportNode?.countries.find((node) => node.country === activeCountry);

  const breadcrumbSegments: BreadcrumbSegment[] = [
    { key: 'home', label: 'Home', href: '/' },
    {
      key: 'sport',
      label: displayName('SPORT', decodedSport),
      href: `/sports/${encodeURIComponent(decodedSport)}`,
    },
  ];
  if (showHierarchyBreadcrumb && sportNode && sportNode.countries.length > 1) {
    breadcrumbSegments.push({
      key: 'country',
      label: activeCountry ? displayName('COUNTRY', activeCountry) : 'All countries',
      href: activeCountry
        ? `/sports/${encodeURIComponent(decodedSport)}?country=${encodeURIComponent(activeCountry)}`
        : undefined,
      options: sportNode.countries.map((countryNode) => ({
        key: countryNode.country,
        label: displayName('COUNTRY', countryNode.country),
        href: `/sports/${encodeURIComponent(decodedSport)}?country=${encodeURIComponent(countryNode.country)}`,
      })),
    });
  }
  if (showHierarchyBreadcrumb && activeCountryNode && activeCountryNode.competitions.length > 1) {
    breadcrumbSegments.push({
      key: 'competition',
      label: competitionFilter ? displayName('COMPETITION', competitionFilter) : 'All leagues',
      href: competitionFilter
        ? `/sports/${encodeURIComponent(decodedSport)}?competition=${encodeURIComponent(competitionFilter)}`
        : undefined,
      options: activeCountryNode.competitions.map((competitionNode) => ({
        key: competitionNode.competition,
        label: displayName('COMPETITION', competitionNode.competition),
        href: `/sports/${encodeURIComponent(decodedSport)}?competition=${encodeURIComponent(competitionNode.competition)}`,
      })),
    });
  }

  return (
    <div>
      {breadcrumbSegments.length > 2 && (
        <div className="mb-2">
          <Breadcrumb segments={breadcrumbSegments} />
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BackButton className="-ml-1.5" />
          <span className="brand-flag" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
          <h1 className="font-display text-lg">{heading}</h1>
        </div>
        <div className="flex gap-2" role="group" aria-label="Sort matches">
          <button
            type="button"
            className={`tab${sortMode === 'time' ? ' active' : ''}`}
            aria-pressed={sortMode === 'time'}
            onClick={() => setSortMode('time')}
          >
            Time
          </button>
          <button
            type="button"
            className={`tab${sortMode === 'importance' ? ' active' : ''}`}
            aria-pressed={sortMode === 'importance'}
            onClick={() => setSortMode('importance')}
          >
            Importance
          </button>
        </div>
      </div>

      {decodedSport === ALL_SPORTS && sportsPresent.length > 1 && (
        <div
          className="scrollbar-hide -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Filter by sport"
          data-horizontal-scroll="true"
        >
          <button
            type="button"
            className={`tab shrink-0${!selectedSport ? ' active' : ''}`}
            aria-pressed={!selectedSport}
            onClick={() => setSelectedSport(undefined)}
          >
            All sports
          </button>
          {sportsPresent.map((sport) => (
            <button
              key={sport}
              type="button"
              className={`tab shrink-0${sport === selectedSport ? ' active' : ''}`}
              aria-pressed={sport === selectedSport}
              onClick={() => setSelectedSport(sport)}
            >
              <SportIcon sport={sport} size={16} />
              {displayName('SPORT', sport)}
            </button>
          ))}
        </div>
      )}

      {isPending && <MatchListSkeleton />}
      {isError && <Card className="text-danger">Failed to load matches.</Card>}
      {sorted && sorted.length === 0 && (
        <Card className="text-text-secondary">No matches available right now.</Card>
      )}
      {visible && visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((match, index) => (
            <MatchCard key={match.id} match={match} style={staggerDelay(index)} />
          ))}
        </div>
      )}
      {sorted && sorted.length > visibleCount && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className="btn-ghost mt-3 flex w-full items-center justify-center sm:inline-flex sm:w-auto"
        >
          Load more
        </button>
      )}
    </div>
  );
}

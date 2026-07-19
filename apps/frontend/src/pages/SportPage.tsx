import { useMemo, useState } from 'react';
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

/** "all" shows every sport unfiltered - used by the homepage's "Live now" load-more, which isn't scoped to one sport. */
const ALL_SPORTS = 'all';

export default function SportPage() {
  const { sport } = useParams<{ sport: string }>();
  const decodedSport = sport ? decodeURIComponent(sport) : ALL_SPORTS;
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const competitionFilter = searchParams.get('competition');
  const countryFilter = searchParams.get('country');
  const liveOnly = location.pathname === '/live' || searchParams.get('live') === 'true';
  const [sortMode, setSortMode] = useState<MatchSortMode>('time');

  const { data: matches, isPending, isError } = useMatches();
  const { data: rankings } = useCompetitionRankings();
  const rankByCompetition = useMemo(() => rankMapFromRankings(rankings ?? []), [rankings]);
  const displayName = useDisplayNames();

  const filtered = matches?.filter(
    (match) =>
      (decodedSport === ALL_SPORTS || match.sport === decodedSport) &&
      (!countryFilter || match.country === countryFilter) &&
      (!competitionFilter || match.competition === competitionFilter) &&
      (!liveOnly || match.isLive),
  );
  const sorted = filtered ? sortMatches(filtered, sortMode, rankByCompetition) : undefined;
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
  const sportNode = useMemo(() => buildSportTree(matches ?? []), [matches]).find(
    (node) => node.sport === decodedSport,
  );
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

      {isPending && <MatchListSkeleton />}
      {isError && <Card className="text-danger">Failed to load matches.</Card>}
      {sorted && sorted.length === 0 && (
        <Card className="text-text-secondary">No matches available right now.</Card>
      )}
      {sorted && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}

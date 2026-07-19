import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MatchCard } from '../features/odds-board/MatchCard';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { useMatches } from '../features/odds-board/useMatches';
import { useCompetitionRankings } from '../features/odds-board/useCompetitionRankings';
import { rankMapFromRankings, sortMatches, type MatchSortMode } from '../features/odds-board/sortMatches';
import { Card } from '../components/ui/Card';

/** "all" shows every sport unfiltered - used by the homepage's "Live now" load-more, which isn't scoped to one sport. */
const ALL_SPORTS = 'all';

export default function SportPage() {
  const { sport } = useParams<{ sport: string }>();
  const decodedSport = sport ? decodeURIComponent(sport) : ALL_SPORTS;
  const [searchParams] = useSearchParams();
  const competitionFilter = searchParams.get('competition');
  const [sortMode, setSortMode] = useState<MatchSortMode>('time');

  const { data: matches, isPending, isError } = useMatches();
  const { data: rankings } = useCompetitionRankings();
  const rankByCompetition = useMemo(() => rankMapFromRankings(rankings ?? []), [rankings]);

  const filtered = matches?.filter(
    (match) =>
      (decodedSport === ALL_SPORTS || match.sport === decodedSport) &&
      (!competitionFilter || match.competition === competitionFilter),
  );
  const sorted = filtered ? sortMatches(filtered, sortMode, rankByCompetition) : undefined;
  const heading = competitionFilter ?? (decodedSport === ALL_SPORTS ? 'All matches' : decodedSport);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="brand-flag" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
          <h1 className="font-display text-xl">{heading}</h1>
        </div>
        <div className="flex gap-2" role="group" aria-label="Sort matches">
          <button
            type="button"
            className={`slash tab${sortMode === 'time' ? ' active' : ''}`}
            aria-pressed={sortMode === 'time'}
            onClick={() => setSortMode('time')}
          >
            Time
          </button>
          <button
            type="button"
            className={`slash tab${sortMode === 'importance' ? ' active' : ''}`}
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

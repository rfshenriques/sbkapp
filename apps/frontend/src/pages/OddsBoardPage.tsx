import { MatchCard } from '../features/odds-board/MatchCard';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { useMatches } from '../features/odds-board/useMatches';

export default function OddsBoardPage() {
  const { data: matches, isPending, isError } = useMatches();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Odds Board</h1>
      <div className="mt-4">
        {isPending && <MatchListSkeleton />}
        {isError && <p className="text-danger">Failed to load matches.</p>}
        {matches && (
          <div className="space-y-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

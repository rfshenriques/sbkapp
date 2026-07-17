import { useParams } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { useMatch } from '../features/match-detail/useMatch';

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const { data: match, isPending, isError } = useMatch(matchId);

  if (isPending) {
    return (
      <div className="space-y-3" aria-label="Loading match" role="status">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !match) {
    return <p className="text-danger">Match not found.</p>;
  }

  const matchResult = match.markets.find((market) => market.id === 'match-result');

  return (
    <div>
      <p className="text-xs text-text-muted">{match.competition}</p>
      <h1 className="text-2xl font-semibold">
        {match.homeTeam} vs {match.awayTeam}
      </h1>
      {match.isLive && (
        <span className="mt-2 inline-block rounded bg-danger px-2 py-0.5 text-xs font-semibold text-white">
          LIVE
        </span>
      )}
      {matchResult && (
        <dl className="mt-4 space-y-1">
          {matchResult.selections.map((selection) => (
            <div key={selection.id} className="flex justify-between text-sm">
              <dt className="text-text-secondary">{selection.name}</dt>
              <dd className="font-semibold">{selection.odds.toFixed(2)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

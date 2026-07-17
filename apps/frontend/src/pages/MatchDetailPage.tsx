import { useParams } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { MarketSelections } from '../features/bet-slip/MarketSelections';
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
  const matchLabel = `${match.homeTeam} vs ${match.awayTeam}`;

  return (
    <div>
      <p className="text-xs text-text-muted">{match.competition}</p>
      <h1 className="text-2xl font-semibold">{matchLabel}</h1>
      {match.isLive && (
        <span className="mt-2 inline-block rounded bg-danger px-2 py-0.5 text-xs font-semibold text-white">
          LIVE
        </span>
      )}
      {matchResult && (
        <div className="mt-4">
          <MarketSelections matchId={match.id} matchLabel={matchLabel} market={matchResult} />
        </div>
      )}
    </div>
  );
}

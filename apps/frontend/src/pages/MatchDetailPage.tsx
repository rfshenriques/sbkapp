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
  const kickoff = new Date(match.kickoff);

  return (
    <div>
      <p className="text-xs font-semibold text-text-muted">
        <span>{match.competition}</span>
      </p>

      <section className="relative mt-2 overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <span
          className={`slash mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
            match.isLive ? 'bg-price-down text-white' : 'bg-highlight text-black'
          }`}
        >
          {match.isLive ? 'Live' : 'Pre-match'}
        </span>
        <h1 className="font-display text-3xl leading-none sm:text-4xl">{matchLabel}</h1>
        {!match.isLive && (
          <p className="mt-2 text-sm text-text-secondary">
            {kickoff.toLocaleString(undefined, {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </section>

      {matchResult ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="brand-flag" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <h2 className="font-display text-xl">{matchResult.name}</h2>
          </div>
          <MarketSelections matchId={match.id} matchLabel={matchLabel} market={matchResult} />
        </div>
      ) : (
        <p className="mt-6 text-text-secondary">No odds available for this match yet.</p>
      )}
    </div>
  );
}

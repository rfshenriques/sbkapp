import { MatchCard } from '../features/odds-board/MatchCard';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { useMatches } from '../features/odds-board/useMatches';
import { MarketSelections } from '../features/bet-slip/MarketSelections';
import { Card } from '../components/ui/Card';
import type { Match } from '@sportsbook/shared';

function sortByKickoff(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  });
}

export default function OddsBoardPage() {
  const { data: matches, isPending, isError } = useMatches();
  const sorted = matches ? sortByKickoff(matches) : undefined;
  const featured = sorted?.[0];
  const rest = sorted?.slice(1);
  const featuredMatchResult = featured?.markets.find((market) => market.id === 'match-result');

  return (
    <div>
      {featured && featuredMatchResult && (
        <section className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-surface p-6">
          <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-highlight">
            <span className="h-[3px] w-6 -skew-x-[24deg] bg-brand" aria-hidden="true" />
            {featured.isLive ? 'Live now' : 'Featured'}
          </span>
          <h1 className="font-display text-4xl leading-none sm:text-5xl">
            {featured.homeTeam} vs {featured.awayTeam}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {featured.competition}
            {!featured.isLive &&
              ` · ${new Date(featured.kickoff).toLocaleString(undefined, {
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}`}
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

      <div className="mb-3 flex items-center gap-2">
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <h2 className="font-display text-xl">Upcoming</h2>
      </div>

      {isPending && <MatchListSkeleton />}
      {isError && <Card className="text-danger">Failed to load matches.</Card>}
      {rest && rest.length === 0 && !featured && (
        <Card className="text-text-secondary">No matches available right now.</Card>
      )}
      {rest && rest.length > 0 && (
        <div className="space-y-3">
          {rest.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}

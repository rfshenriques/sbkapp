import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { MarketSelections } from '../bet-slip/MarketSelections';
import { usePrefetchMatchDetail } from './usePrefetchMatchDetail';
import type { Match } from '@sportsbook/shared';

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const matchResult = match.markets.find((market) => market.id === 'match-result');
  const prefetchMatchDetail = usePrefetchMatchDetail();
  const matchLabel = `${match.homeTeam} vs ${match.awayTeam}`;
  const kickoff = new Date(match.kickoff);

  return (
    <Card className="transition-colors hover:border-text-muted">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <span>{match.competition}</span>
            {!match.isLive && (
              <span className="text-highlight">
                {kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
          <Link
            to={`/matches/${match.id}`}
            className="font-semibold hover:underline"
            onMouseEnter={() => prefetchMatchDetail(match.id)}
            onTouchStart={() => prefetchMatchDetail(match.id)}
          >
            {matchLabel}
          </Link>
        </div>
        {match.isLive && (
          <span className="slash shrink-0 bg-price-down px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white">
            LIVE
          </span>
        )}
      </div>
      {matchResult && (
        <div className="mt-3">
          <MarketSelections matchId={match.id} matchLabel={matchLabel} market={matchResult} />
        </div>
      )}
    </Card>
  );
}

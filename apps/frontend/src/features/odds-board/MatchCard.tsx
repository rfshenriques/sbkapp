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

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-text-muted">{match.competition}</p>
          <Link
            to={`/matches/${match.id}`}
            className="font-medium hover:underline"
            onMouseEnter={() => prefetchMatchDetail(match.id)}
            onTouchStart={() => prefetchMatchDetail(match.id)}
          >
            {matchLabel}
          </Link>
        </div>
        {match.isLive && (
          <span className="shrink-0 rounded bg-danger px-2 py-0.5 text-xs font-semibold text-white">
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

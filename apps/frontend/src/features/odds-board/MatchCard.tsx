import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useBetSlipStore } from '../bet-slip/betSlipStore';
import type { Match } from '../../mocks/types';

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const matchResult = match.markets.find((market) => market.id === 'match-result');
  const toggleSelection = useBetSlipStore((state) => state.toggleSelection);
  const selectedSelectionId = useBetSlipStore(
    (state) =>
      state.selections.find(
        (selection) => selection.matchId === match.id && selection.marketId === matchResult?.id,
      )?.selectionId,
  );

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-text-muted">{match.competition}</p>
          <Link to={`/matches/${match.id}`} className="font-medium hover:underline">
            {match.homeTeam} vs {match.awayTeam}
          </Link>
        </div>
        {match.isLive && (
          <span className="shrink-0 rounded bg-danger px-2 py-0.5 text-xs font-semibold text-white">
            LIVE
          </span>
        )}
      </div>
      {matchResult && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {matchResult.selections.map((selection) => (
            <Button
              key={selection.id}
              variant={selectedSelectionId === selection.id ? 'primary' : 'secondary'}
              className="flex flex-col items-center"
              onClick={() =>
                toggleSelection({
                  matchId: match.id,
                  marketId: matchResult.id,
                  selectionId: selection.id,
                  matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
                  marketName: matchResult.name,
                  selectionName: selection.name,
                  odds: selection.odds,
                })
              }
            >
              <span className="text-xs text-text-secondary">{selection.name}</span>
              <span className="font-semibold">{selection.odds.toFixed(2)}</span>
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

import { Button } from '../../components/ui/Button';
import type { Market } from '../../mocks/types';
import { useBetSlipStore } from './betSlipStore';

interface MarketSelectionsProps {
  matchId: string;
  matchLabel: string;
  market: Market;
}

export function MarketSelections({ matchId, matchLabel, market }: MarketSelectionsProps) {
  const toggleSelection = useBetSlipStore((state) => state.toggleSelection);
  const selectedSelectionId = useBetSlipStore(
    (state) =>
      state.selections.find(
        (selection) => selection.matchId === matchId && selection.marketId === market.id,
      )?.selectionId,
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {market.selections.map((selection) => (
        <Button
          key={selection.id}
          variant={selectedSelectionId === selection.id ? 'primary' : 'secondary'}
          className="flex flex-col items-center"
          onClick={() =>
            toggleSelection({
              matchId,
              marketId: market.id,
              selectionId: selection.id,
              matchLabel,
              marketName: market.name,
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
  );
}

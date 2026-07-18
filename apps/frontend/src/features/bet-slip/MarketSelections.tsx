import type { Market } from '@sportsbook/shared';
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
        <button
          key={selection.id}
          type="button"
          className={`odd-btn${selectedSelectionId === selection.id ? ' selected' : ''}`}
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
          <span className="odd-label">{selection.name}</span>
          <span className="odd-value">{selection.odds.toFixed(2)}</span>
        </button>
      ))}
    </div>
  );
}

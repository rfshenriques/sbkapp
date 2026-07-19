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
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${market.selections.length}, minmax(0, 1fr))` }}
    >
      {market.selections.map((selection) => (
        <button
          key={selection.id}
          type="button"
          className={`odd-btn${selectedSelectionId === selection.id ? ' selected' : ''}`}
          onClick={(event) => {
            // MatchCard's whole card is clickable and navigates to the match
            // - stop this from also triggering that when picking an odd.
            event.stopPropagation();
            toggleSelection({
              matchId,
              marketId: market.id,
              selectionId: selection.id,
              matchLabel,
              marketName: market.name,
              selectionName: selection.name,
              odds: selection.odds,
            });
          }}
        >
          <span className="odd-label">{selection.name}</span>
          <span className="odd-value">{selection.odds.toFixed(2)}</span>
        </button>
      ))}
    </div>
  );
}

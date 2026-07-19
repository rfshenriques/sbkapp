import type { Market } from '@sportsbook/shared';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { useBetSlipStore } from './betSlipStore';
import { sortMatchResultSelections } from './sortMatchResultSelections';

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
  const displayName = useDisplayNames();

  const orderedSelections = sortMatchResultSelections(market.selections);

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${orderedSelections.length}, minmax(0, 1fr))` }}
    >
      {orderedSelections.map((selection) => {
        const selectionLabel = displayName('SELECTION', selection.name);
        return (
          <button
            key={selection.id}
            type="button"
            className={`odd-btn${selectedSelectionId === selection.id ? ' selected' : ''}`}
            onClick={(event) => {
              // MatchCard's whole card is clickable and navigates to the
              // match - stop this from also triggering that when picking an
              // odd.
              event.stopPropagation();
              toggleSelection({
                matchId,
                marketId: market.id,
                selectionId: selection.id,
                matchLabel,
                marketName: displayName('MARKET', market.name),
                selectionName: selectionLabel,
                odds: selection.odds,
              });
            }}
          >
            <span className="odd-label">{selectionLabel}</span>
            <span className="odd-value">{selection.odds.toFixed(2)}</span>
          </button>
        );
      })}
    </div>
  );
}

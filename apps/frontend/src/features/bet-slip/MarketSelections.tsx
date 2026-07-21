import type { Market, Selection } from '@sportsbook/shared';
import { LockIcon } from '../../components/ui/LockIcon';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { useBetSlipStore } from './betSlipStore';
import { sortMatchResultSelections } from './sortMatchResultSelections';
import { useMarketSuspensions } from './useMarketSuspensions';
import { useOddsFlash } from './useOddsFlash';

interface MarketSelectionsProps {
  matchId: string;
  matchLabel: string;
  market: Market;
}

interface SelectionButtonProps {
  selection: Selection;
  label: string;
  isSelected: boolean;
  isSuspended: boolean;
  onSelect: () => void;
}

function SelectionButton({ selection, label, isSelected, isSuspended, onSelect }: SelectionButtonProps) {
  const flash = useOddsFlash(selection.odds);

  return (
    <button
      type="button"
      disabled={isSuspended}
      aria-label={isSuspended ? `${label} suspended` : undefined}
      className={`odd-btn${isSelected ? ' selected' : ''}${isSuspended ? ' suspended' : ''}`}
      onClick={(event) => {
        // MatchCard's whole card is clickable and navigates to the match -
        // stop this from also triggering that when picking an odd.
        event.stopPropagation();
        onSelect();
      }}
    >
      <span className="odd-label">{label}</span>
      {isSuspended ? (
        <LockIcon className="h-4 w-4" aria-hidden="true" />
      ) : (
        <span className={`odd-value${flash ? ` flash-${flash}` : ''}`}>{selection.odds.toFixed(2)}</span>
      )}
    </button>
  );
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
  const { isSuspended } = useMarketSuspensions();

  const orderedSelections = sortMatchResultSelections(market.selections);
  const marketSuspended = isSuspended(matchId, market.id);

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${orderedSelections.length}, minmax(0, 1fr))` }}
    >
      {orderedSelections.map((selection) => {
        const selectionLabel = displayName('SELECTION', selection.name);
        return (
          <SelectionButton
            key={selection.id}
            selection={selection}
            label={selectionLabel}
            isSelected={selectedSelectionId === selection.id}
            isSuspended={marketSuspended}
            onSelect={() =>
              toggleSelection({
                matchId,
                marketId: market.id,
                selectionId: selection.id,
                matchLabel,
                marketName: displayName('MARKET', market.name),
                selectionName: selectionLabel,
                odds: selection.odds,
              })
            }
          />
        );
      })}
    </div>
  );
}

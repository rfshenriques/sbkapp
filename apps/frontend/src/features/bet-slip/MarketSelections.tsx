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
  /** Raw feed competition name, e.g. "EPL" - checked against competition-level suspensions, which lock every selection here regardless of any market/selection-level suspension. */
  competition: string;
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
  // originalOdds is only ever set by the backend when a boost actually changed the price (see BoostService.applyBoosts).
  const isBoosted = selection.originalOdds !== undefined;

  return (
    <button
      type="button"
      disabled={isSuspended}
      aria-label={
        isSuspended
          ? `${label} suspended`
          : isBoosted
            ? `${label} boosted to ${selection.odds.toFixed(2)}, was ${selection.originalOdds!.toFixed(2)}`
            : undefined
      }
      className={`odd-btn${isSelected ? ' selected' : ''}${isSuspended ? ' suspended' : ''}${flash ? ` flash-${flash}` : ''}`}
      onClick={(event) => {
        // MatchCard's whole card is clickable and navigates to the match -
        // stop this from also triggering that when picking an odd.
        event.stopPropagation();
        onSelect();
      }}
    >
      {isBoosted && !isSuspended && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-highlight px-1.5 py-px text-[8px] font-extrabold tracking-wide text-black uppercase">
          Boost
        </span>
      )}
      <span className="odd-label">{label}</span>
      {isSuspended ? (
        <LockIcon className="h-4 w-4" aria-hidden="true" />
      ) : isBoosted ? (
        // Stacked, not side-by-side: the narrowest match cards (e.g. the
        // homepage's featured/hero card) only have ~60px per column, too
        // tight to fit a struck-through price and the new one on one line.
        <span className="flex flex-col items-center leading-none">
          <span className="text-[9px] text-text-muted line-through">{selection.originalOdds!.toFixed(2)}</span>
          <span className="odd-value text-highlight">{selection.odds.toFixed(2)}</span>
        </span>
      ) : (
        <span className="odd-value">{selection.odds.toFixed(2)}</span>
      )}
    </button>
  );
}

export function MarketSelections({ matchId, matchLabel, competition, market }: MarketSelectionsProps) {
  const toggleSelection = useBetSlipStore((state) => state.toggleSelection);
  const selectedSelectionId = useBetSlipStore(
    (state) =>
      state.selections.find(
        (selection) => selection.matchId === matchId && selection.marketId === market.id,
      )?.selectionId,
  );
  const displayName = useDisplayNames();
  const { isSuspended, isCompetitionSuspended } = useMarketSuspensions();

  const orderedSelections = sortMatchResultSelections(market.selections);
  const competitionSuspended = isCompetitionSuspended(competition);

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
            isSuspended={competitionSuspended || isSuspended(matchId, market.id, selection.id)}
            onSelect={() =>
              toggleSelection({
                matchId,
                marketId: market.id,
                selectionId: selection.id,
                matchLabel,
                marketName: displayName('MARKET', market.name),
                selectionName: selectionLabel,
                odds: selection.odds,
                originalOdds: selection.originalOdds,
              })
            }
          />
        );
      })}
    </div>
  );
}

import type { Market, Selection } from '@sportsbook/shared';
import { BoostIcon } from '../../components/ui/BoostIcon';
import { LockIcon } from '../../components/ui/LockIcon';
import { track } from '../../lib/analytics';
import { formatMoney } from '../../lib/currency';
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
  /** 'stacked' (default) is the label-above-value .odd-btn used by the bet
   * slip and match-detail page's per-market cards. 'inline' is the
   * label-beside-value compact style MatchCard's Lucky.fun-style match
   * list rows use. */
  variant?: 'stacked' | 'inline';
  /** Reserves the taller boosted-price layout (struck-through previous
   * price above the current one) even for a selection that isn't actually
   * boosted, via an invisible placeholder line - so every card in a set
   * ends up the same height regardless of which ones happen to carry a
   * boost right now. Only Match of the day's featured cards need this
   * (see OddsBoardPage's FeaturedMatchCard) - elsewhere a plain one-line
   * price is correct. */
  reserveBoostSpace?: boolean;
}

interface SelectionButtonProps {
  selection: Selection;
  label: string;
  isSelected: boolean;
  isSuspended: boolean;
  variant: 'stacked' | 'inline';
  reserveBoostSpace: boolean;
  onSelect: () => void;
}

function SelectionButton({ selection, label, isSelected, isSuspended, variant, reserveBoostSpace, onSelect }: SelectionButtonProps) {
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
            ? `${label} boosted to ${selection.odds.toFixed(2)}, was ${selection.originalOdds!.toFixed(2)}${
                selection.maxStakeCents !== undefined
                  ? `, max stake ${formatMoney(selection.maxStakeCents)}`
                  : ''
              }`
            : undefined
      }
      className={`odd-btn${variant === 'inline' ? ' inline-odds' : ''}${isSelected ? ' selected' : ''}${isSuspended ? ' suspended' : ''}${flash ? ` flash-${flash}` : ''}`}
      onClick={(event) => {
        // MatchCard's whole card is clickable and navigates to the match -
        // stop this from also triggering that when picking an odd.
        event.stopPropagation();
        onSelect();
      }}
    >
      {isBoosted && !isSuspended && (
        // Corner badge, not a centered label pill - centered over the whole
        // button read as floating/detached from the price on the wider
        // label-beside-value row layout (variant="inline"), and overlapped
        // the label text above it on narrow cards. A small icon-only badge
        // in the corner (same spot the boosted-odds reference mockup used)
        // stays out of the way of both the label and the price it marks.
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-highlight text-black"
        >
          <BoostIcon className="h-2.5 w-2.5" />
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
          <span className="prev-odds text-xs font-semibold line-through decoration-1">
            {selection.originalOdds!.toFixed(2)}
          </span>
          <span className="odd-value text-highlight">{selection.odds.toFixed(2)}</span>
        </span>
      ) : reserveBoostSpace ? (
        <span className="flex flex-col items-center leading-none">
          <span className="prev-odds invisible text-xs font-semibold" aria-hidden="true">
            {selection.odds.toFixed(2)}
          </span>
          <span className="odd-value">{selection.odds.toFixed(2)}</span>
        </span>
      ) : (
        <span className="odd-value">{selection.odds.toFixed(2)}</span>
      )}
    </button>
  );
}

export function MarketSelections({
  matchId,
  matchLabel,
  competition,
  market,
  variant = 'stacked',
  reserveBoostSpace = false,
}: MarketSelectionsProps) {
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
            variant={variant}
            reserveBoostSpace={reserveBoostSpace}
            onSelect={() => {
              track('CLICK', {
                metadata: {
                  target: 'odds_selection',
                  matchId,
                  marketId: market.id,
                  selectionId: selection.id,
                  wasSelected: selectedSelectionId === selection.id,
                },
              });
              toggleSelection({
                matchId,
                marketId: market.id,
                selectionId: selection.id,
                matchLabel,
                marketName: displayName('MARKET', market.name),
                selectionName: selectionLabel,
                odds: selection.odds,
                originalOdds: selection.originalOdds,
                maxStakeCents: selection.maxStakeCents ?? market.maxStakeCents,
                marketSinglesOnly: market.singlesOnly,
              });
            }}
          />
        );
      })}
    </div>
  );
}

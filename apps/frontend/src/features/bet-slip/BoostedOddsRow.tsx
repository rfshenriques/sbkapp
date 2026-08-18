import { LockIcon } from '../../components/ui/LockIcon';
import { formatMoney } from '../../lib/currency';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { useBetSlipStore } from './betSlipStore';
import { useMarketSuspensions } from './useMarketSuspensions';

interface BoostedOddsRowProps {
  matchId: string;
  matchLabel: string;
  competition: string;
  marketId: string;
  marketName: string;
  selectionId: string;
  selectionName: string;
  odds: number;
  previousOdds: number;
  maxStakeCents?: number;
}

/**
 * One boosted selection's label + previous-price/arrow/clickable-new-price
 * row - shared between BoostsPage (wrapped in its own per-match Card) and
 * MatchDetailPage's Boosts section (already inside that match's context, so
 * no per-row match header needed) so both stay visually identical.
 */
export function BoostedOddsRow({
  matchId,
  matchLabel,
  competition,
  marketId,
  marketName,
  selectionId,
  selectionName,
  odds,
  previousOdds,
  maxStakeCents,
}: BoostedOddsRowProps) {
  const displayName = useDisplayNames();
  const toggleSelection = useBetSlipStore((state) => state.toggleSelection);
  const selectedSelectionId = useBetSlipStore(
    (state) =>
      state.selections.find((selection) => selection.matchId === matchId && selection.marketId === marketId)
        ?.selectionId,
  );
  const { isSuspended, isCompetitionSuspended } = useMarketSuspensions();
  const suspended = isCompetitionSuspended(competition) || isSuspended(matchId, marketId, selectionId);
  const isSelected = selectedSelectionId === selectionId;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-text-secondary">
          {displayName('MARKET', marketName)}: {displayName('SELECTION', selectionName)}
        </p>
        {maxStakeCents !== undefined && (
          <p className="text-[11px] text-text-secondary">
            Max stake for boosted price: {formatMoney(maxStakeCents)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="prev-odds text-base font-semibold line-through decoration-1">
          {previousOdds.toFixed(2)}
        </span>
        <span className="text-text-secondary" aria-hidden="true">
          &rarr;
        </span>
        <button
          type="button"
          disabled={suspended}
          aria-label={
            suspended
              ? `${selectionName} suspended`
              : `${selectionName} boosted to ${odds.toFixed(2)}, was ${previousOdds.toFixed(2)}${
                  maxStakeCents !== undefined ? `, max stake ${formatMoney(maxStakeCents)}` : ''
                }`
          }
          className={`odd-btn large${isSelected ? ' selected' : ''}${suspended ? ' suspended' : ''}`}
          onClick={() =>
            toggleSelection({
              matchId,
              marketId,
              selectionId,
              matchLabel,
              marketName: displayName('MARKET', marketName),
              selectionName: displayName('SELECTION', selectionName),
              odds,
              originalOdds: previousOdds,
              maxStakeCents,
            })
          }
        >
          {suspended ? (
            <LockIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <span className="odd-value text-highlight">{odds.toFixed(2)}</span>
          )}
        </button>
      </div>
    </div>
  );
}

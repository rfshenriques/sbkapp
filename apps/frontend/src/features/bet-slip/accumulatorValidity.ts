import type { BetSlipSelection } from './betSlipStore';

/**
 * Mirrors PamService's accumulator-composition checks
 * (assertWithinBoostLimitsAndCollectLiability /
 * assertWithinManualMarketLimitsAndCollectLiability) so the bet slip can
 * warn before a player tries to place a bet that would just get rejected.
 * Only meaningful for 2+ selections - a single selection is never combined
 * with anything, so it can't violate either rule. Returns the reason it's
 * invalid, or null when the combination is fine.
 */
export function invalidAccumulatorReason(selections: BetSlipSelection[]): string | null {
  if (selections.length < 2) {
    return null;
  }

  const boostedCount = selections.filter((selection) => selection.originalOdds !== undefined).length;
  if (boostedCount > 1) {
    return 'Only one boosted selection can be combined in an accumulator.';
  }

  const singlesOnlySelection = selections.find((selection) => selection.marketSinglesOnly);
  if (singlesOnlySelection) {
    return `${singlesOnlySelection.marketName} can only be bet as a single, not combined in an accumulator.`;
  }

  return null;
}

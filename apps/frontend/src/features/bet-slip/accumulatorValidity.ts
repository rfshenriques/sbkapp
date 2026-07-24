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

  if (hasSameEventSelections(selections)) {
    return "Selections from the same event can't be combined into an accumulator.";
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

/**
 * Mirrors PamService's assertNoSameEventAccumulator - two selections from
 * different markets on the same event are correlated in a way a plain
 * product-of-odds accumulator doesn't price for, so combining them is only
 * safe once a dedicated bet builder exists. Exported separately (not just
 * folded into invalidAccumulatorReason's string) so BetSlipPanel can react
 * to the boolean directly, e.g. to force the tab back to Singles.
 */
export function hasSameEventSelections(selections: BetSlipSelection[]): boolean {
  const matchIds = selections.map((selection) => selection.matchId);
  return new Set(matchIds).size !== matchIds.length;
}

/**
 * Mirrors PamService's assertInsuranceEligible - a boosted price or a
 * singles-only special is already priced with its own subsidy/no-correlation
 * assumption, so insurance never applies on top of either. Used to hide the
 * insurance toggle before the player can even opt in, not just to explain a
 * rejection after the fact.
 */
export function hasInsuranceIneligibleSelection(selections: BetSlipSelection[]): boolean {
  return selections.some((selection) => selection.originalOdds !== undefined || selection.marketSinglesOnly);
}

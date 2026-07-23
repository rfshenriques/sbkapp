export interface AccaBoostConfigValues {
  boostPercentPerLeg: number;
  minSelections: number;
  minOddsPerLeg: number;
  enabled: boolean;
}

export interface AccaBoostResult {
  qualifies: boolean;
  /** e.g. 15 for +15% - 0 when the bet doesn't qualify. */
  boostPercent: number;
  baseCombinedOdds: number;
  boostedCombinedOdds: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Boost = boostPercentPerLeg added once per selection (5% x 4 legs = +20%,
 * not a flat bonus and not compounding) - applied once to the whole
 * accumulator's combined odds, never to each leg's own price. Requires
 * every leg to individually clear minOddsPerLeg and the bet to have at
 * least minSelections legs; a single missed leg or too few legs means no
 * boost at all, not a partial one.
 */
export function calculateAccaBoost(legOdds: number[], config: AccaBoostConfigValues): AccaBoostResult {
  const baseCombinedOdds = legOdds.reduce((total, odds) => total * odds, 1);
  const qualifies =
    config.enabled &&
    legOdds.length >= config.minSelections &&
    legOdds.every((odds) => odds >= config.minOddsPerLeg);

  if (!qualifies) {
    return { qualifies: false, boostPercent: 0, baseCombinedOdds, boostedCombinedOdds: baseCombinedOdds };
  }

  const boostPercent = round2(config.boostPercentPerLeg * legOdds.length);
  const boostedCombinedOdds = round2(baseCombinedOdds * (1 + boostPercent / 100));
  return { qualifies: true, boostPercent, baseCombinedOdds, boostedCombinedOdds };
}

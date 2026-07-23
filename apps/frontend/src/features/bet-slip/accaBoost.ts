/**
 * Client-side mirror of the backend's PamService/acca-boost.ts calculation -
 * used for the bet slip's live preview only. The backend recomputes and
 * locks in the real boost at placement time, so this is a UI convenience,
 * not the authoritative number.
 */
export interface AccaBoostConfig {
  boostPercentPerLeg: number;
  minSelections: number;
  minOddsPerLeg: number;
  enabled: boolean;
}

export interface AccaBoostPreview {
  qualifies: boolean;
  boostPercent: number;
  baseCombinedOdds: number;
  boostedCombinedOdds: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateAccaBoost(legOdds: number[], config: AccaBoostConfig): AccaBoostPreview {
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

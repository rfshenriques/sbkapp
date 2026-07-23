import { describe, expect, it } from 'vitest';
import { calculateAccaBoost, type AccaBoostConfigValues } from './acca-boost';

const config: AccaBoostConfigValues = {
  boostPercentPerLeg: 5,
  minSelections: 3,
  minOddsPerLeg: 1.2,
  enabled: true,
};

describe('calculateAccaBoost', () => {
  it('does not qualify below minSelections', () => {
    const result = calculateAccaBoost([2.0, 2.0], config);

    expect(result.qualifies).toBe(false);
    expect(result.boostPercent).toBe(0);
    expect(result.boostedCombinedOdds).toBe(result.baseCombinedOdds);
  });

  it('does not qualify when any leg is below minOddsPerLeg', () => {
    const result = calculateAccaBoost([2.0, 2.0, 1.1], config);

    expect(result.qualifies).toBe(false);
    expect(result.boostPercent).toBe(0);
  });

  it('does not qualify when disabled, even if every other condition is met', () => {
    const result = calculateAccaBoost([2.0, 2.0, 2.0], { ...config, enabled: false });

    expect(result.qualifies).toBe(false);
  });

  it('boosts by boostPercentPerLeg times the number of legs when it qualifies', () => {
    // 3 legs at 5%/leg -> 15% boost. Base combined = 2 * 2 * 2 = 8. Boosted = 8 * 1.15 = 9.2.
    const result = calculateAccaBoost([2.0, 2.0, 2.0], config);

    expect(result.qualifies).toBe(true);
    expect(result.boostPercent).toBe(15);
    expect(result.baseCombinedOdds).toBe(8);
    expect(result.boostedCombinedOdds).toBe(9.2);
  });

  it('one more selection adds another boostPercentPerLeg of boost', () => {
    const threeLegs = calculateAccaBoost([2.0, 2.0, 2.0], config);
    const fourLegs = calculateAccaBoost([2.0, 2.0, 2.0, 2.0], config);

    expect(fourLegs.boostPercent - threeLegs.boostPercent).toBe(5);
  });
});

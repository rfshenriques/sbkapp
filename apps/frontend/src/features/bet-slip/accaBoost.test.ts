import { describe, expect, it } from 'vitest';
import { calculateAccaBoost, type AccaBoostConfig } from './accaBoost';

const config: AccaBoostConfig = {
  boostPercentPerLeg: 5,
  minSelections: 3,
  minOddsPerLeg: 1.2,
  enabled: true,
};

describe('calculateAccaBoost', () => {
  it('does not qualify below minSelections', () => {
    const result = calculateAccaBoost([2.0, 2.0], config);
    expect(result.qualifies).toBe(false);
    expect(result.boostedCombinedOdds).toBe(result.baseCombinedOdds);
  });

  it('does not qualify when any leg is below minOddsPerLeg', () => {
    expect(calculateAccaBoost([2.0, 2.0, 1.1], config).qualifies).toBe(false);
  });

  it('does not qualify when disabled', () => {
    expect(calculateAccaBoost([2.0, 2.0, 2.0], { ...config, enabled: false }).qualifies).toBe(false);
  });

  it('boosts by boostPercentPerLeg times the number of legs when it qualifies', () => {
    const result = calculateAccaBoost([2.0, 2.0, 2.0], config);
    expect(result.qualifies).toBe(true);
    expect(result.boostPercent).toBe(15);
    expect(result.boostedCombinedOdds).toBe(9.2);
  });

  it('one more selection adds another boostPercentPerLeg of boost', () => {
    const threeLegs = calculateAccaBoost([2.0, 2.0, 2.0], config);
    const fourLegs = calculateAccaBoost([2.0, 2.0, 2.0, 2.0], config);
    expect(fourLegs.boostPercent - threeLegs.boostPercent).toBe(5);
  });
});

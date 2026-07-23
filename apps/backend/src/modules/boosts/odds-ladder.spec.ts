import { describe, expect, it } from 'vitest';
import { applyBoostToPrice, generateStandardLadder, nearestRungIndex } from './odds-ladder';

describe('generateStandardLadder', () => {
  it('starts at 1.01 and ends at 1000', () => {
    const ladder = generateStandardLadder();

    expect(ladder[0]).toBe(1.01);
    expect(ladder[ladder.length - 1]).toBe(1000);
  });

  it('is strictly ascending with no duplicates', () => {
    const ladder = generateStandardLadder();

    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]).toBeGreaterThan(ladder[i - 1]!);
    }
  });

  it('uses 0.01 steps below 2.00 and wider steps once the price grows', () => {
    const ladder = generateStandardLadder();

    expect(ladder).toContain(1.02);
    expect(ladder).toContain(1.99);
    expect(ladder).toContain(2.02); // 2.00-3.00 band steps by 0.02
    expect(ladder).toContain(5.1); // 4.00-6.00 band steps by 0.10
    expect(ladder).toContain(25); // 20.00-30.00 band steps by 1
  });
});

describe('nearestRungIndex', () => {
  const ladder = [1.5, 2.0, 2.5, 3.0];

  it('returns the exact rung when the price is already on the ladder', () => {
    expect(nearestRungIndex(ladder, 2.5)).toBe(2);
  });

  it('returns the closer of two neighboring rungs', () => {
    expect(nearestRungIndex(ladder, 2.1)).toBe(1); // closer to 2.0 than 2.5
    expect(nearestRungIndex(ladder, 2.4)).toBe(2); // closer to 2.5 than 2.0
  });

  it('clamps to the first/last rung for out-of-range prices', () => {
    expect(nearestRungIndex(ladder, 0.5)).toBe(0);
    expect(nearestRungIndex(ladder, 10)).toBe(3);
  });
});

describe('applyBoostToPrice', () => {
  const ladder = [1.5, 2.0, 2.5, 3.0, 3.5];

  it('climbs the requested number of rungs from the nearest rung to the price', () => {
    expect(applyBoostToPrice(ladder, 2.0, 2)).toBe(3.0);
  });

  it('starts from the nearest rung when the price is not exactly on the ladder', () => {
    // 2.1 is nearest to 2.0 (index 1); +1 tick -> 2.5
    expect(applyBoostToPrice(ladder, 2.1, 1)).toBe(2.5);
  });

  it('zero ticks snaps to the nearest rung without boosting', () => {
    expect(applyBoostToPrice(ladder, 2.1, 0)).toBe(2.0);
  });

  it('clamps at the top rung instead of running off the ladder', () => {
    expect(applyBoostToPrice(ladder, 3.0, 10)).toBe(3.5);
  });

  it('passes the price through unchanged when the ladder is empty', () => {
    expect(applyBoostToPrice([], 2.1, 3)).toBe(2.1);
  });
});

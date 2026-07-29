import { describe, expect, it } from 'vitest';
import { calculateLeaderboardPoints, leaderboardBetCounts } from './leaderboard';

describe('calculateLeaderboardPoints', () => {
  it('computes flat points-per-euro-staked when no odds multiplier is used', () => {
    const points = calculateLeaderboardPoints(
      { pointsPerEuroStaked: 2, useCombinedOddsAsMultiplier: false },
      { stakeCents: 1_000, effectiveCombinedOdds: 5 },
    );
    expect(points).toBe(20); // 10 euros * 2 points/euro, odds ignored
  });

  it('multiplies by the bet\'s effective combined odds when configured', () => {
    const points = calculateLeaderboardPoints(
      { pointsPerEuroStaked: 2, useCombinedOddsAsMultiplier: true },
      { stakeCents: 1_000, effectiveCombinedOdds: 5 },
    );
    expect(points).toBe(100); // 10 euros * 2 points/euro * 5x odds
  });

  it('rounds to the nearest whole point', () => {
    const points = calculateLeaderboardPoints(
      { pointsPerEuroStaked: 1, useCombinedOddsAsMultiplier: true },
      { stakeCents: 333, effectiveCombinedOdds: 1.5 },
    );
    expect(points).toBe(Math.round(3.33 * 1.5));
  });

  it('is zero for a zero stake', () => {
    const points = calculateLeaderboardPoints(
      { pointsPerEuroStaked: 5, useCombinedOddsAsMultiplier: false },
      { stakeCents: 0, effectiveCombinedOdds: 3 },
    );
    expect(points).toBe(0);
  });
});

describe('leaderboardBetCounts', () => {
  it('a PENDING outcome never counts, regardless of the toggle', () => {
    expect(leaderboardBetCounts(true, 'PENDING')).toBe(false);
    expect(leaderboardBetCounts(false, 'PENDING')).toBe(false);
  });

  it('onlySettledWonCounts true: only WON counts', () => {
    expect(leaderboardBetCounts(true, 'WON')).toBe(true);
    expect(leaderboardBetCounts(true, 'LOST')).toBe(false);
    expect(leaderboardBetCounts(true, 'VOID')).toBe(false);
  });

  it('onlySettledWonCounts false: every terminal outcome counts', () => {
    expect(leaderboardBetCounts(false, 'WON')).toBe(true);
    expect(leaderboardBetCounts(false, 'LOST')).toBe(true);
    expect(leaderboardBetCounts(false, 'VOID')).toBe(true);
  });
});

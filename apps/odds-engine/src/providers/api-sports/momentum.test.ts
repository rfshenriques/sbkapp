import { describe, expect, it } from 'vitest';
import { computeMomentum } from './momentum';
import type { LiveMatchStat } from '@sportsbook/shared';

function stats(
  homeShots: number,
  awayShots: number,
  homeCorners: number,
  awayCorners: number,
): LiveMatchStat[] {
  return [
    { type: 'Total Shots', home: homeShots, away: awayShots },
    { type: 'Corner Kicks', home: homeCorners, away: awayCorners },
  ];
}

describe('computeMomentum', () => {
  it('is neutral 50/50 on the first poll, when there is no previous snapshot', () => {
    expect(computeMomentum(undefined, stats(3, 1, 1, 0))).toEqual({ home: 50, away: 50 });
  });

  it('weights the delta toward whichever team generated more shots+corners since the last poll', () => {
    const previous = stats(3, 2, 1, 1);
    const current = stats(8, 2, 3, 1); // home: +5 shots, +2 corners; away: +0, +0
    expect(computeMomentum(previous, current)).toEqual({ home: 100, away: 0 });
  });

  it('splits proportionally when both teams generated some activity', () => {
    const previous = stats(0, 0, 0, 0);
    const current = stats(4, 2, 0, 0); // home: 4, away: 2 -> 4/6 = 66.7% -> rounds to 67
    expect(computeMomentum(previous, current)).toEqual({ home: 67, away: 33 });
  });

  it('holds the previous momentum steady when neither team generated new activity', () => {
    const previous = stats(3, 2, 1, 1);
    const current = stats(3, 2, 1, 1); // no delta
    expect(computeMomentum(previous, current, { home: 70, away: 30 })).toEqual({
      home: 70,
      away: 30,
    });
  });

  it('never goes negative even if a provider count somehow decreases between polls', () => {
    const previous = stats(10, 5, 3, 2);
    const current = stats(9, 6, 3, 3); // home shots "decreased" - clamped to 0 delta
    expect(computeMomentum(previous, current)).toEqual({ home: 0, away: 100 });
  });
});

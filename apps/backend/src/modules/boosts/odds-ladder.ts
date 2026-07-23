interface LadderRange {
  from: number;
  to: number;
  step: number;
}

/**
 * The real industry-standard decimal odds tick ladder - the step between
 * valid prices widens as the price itself gets bigger (the same shape
 * exchanges/bookmakers publish, not a made-up grid). Used as the seed for
 * OddsLadderService.regenerateStandard; trading can add to or remove from
 * it per brand afterward.
 */
export const STANDARD_LADDER_RANGES: LadderRange[] = [
  { from: 1.01, to: 2.0, step: 0.01 },
  { from: 2.0, to: 3.0, step: 0.02 },
  { from: 3.0, to: 4.0, step: 0.05 },
  { from: 4.0, to: 6.0, step: 0.1 },
  { from: 6.0, to: 10.0, step: 0.2 },
  { from: 10.0, to: 20.0, step: 0.5 },
  { from: 20.0, to: 30.0, step: 1 },
  { from: 30.0, to: 50.0, step: 2 },
  { from: 50.0, to: 100.0, step: 5 },
  { from: 100.0, to: 1000.0, step: 10 },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Every valid price on the standard ladder, ascending, 1.01 through 1000.00. */
export function generateStandardLadder(): number[] {
  const values = new Set<number>();
  for (const range of STANDARD_LADDER_RANGES) {
    for (let value = range.from; value < range.to - 1e-9; value += range.step) {
      values.add(round2(value));
    }
  }
  values.add(1000);
  return [...values].sort((a, b) => a - b);
}

/** Index of the ladder rung closest to `price` - ties broken toward the lower rung. `ladder` must be sorted ascending and non-empty. */
export function nearestRungIndex(ladder: number[], price: number): number {
  let nearestIndex = 0;
  let nearestDiff = Infinity;
  for (let i = 0; i < ladder.length; i += 1) {
    const diff = Math.abs(ladder[i]! - price);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestIndex = i;
    }
  }
  return nearestIndex;
}

/**
 * Boosts a price by climbing `ticks` rungs up the ladder from whichever
 * rung is closest to `price` - never a fixed target price, always relative
 * to wherever the price currently sits (so the same boost keeps working as
 * the underlying feed price moves). Clamps at the top rung rather than
 * running off the end of the ladder. An empty ladder means no rungs are
 * configured yet, so the price passes through unboosted.
 */
export function applyBoostToPrice(ladder: number[], price: number, ticks: number): number {
  if (ladder.length === 0) {
    return price;
  }
  const targetIndex = Math.min(ladder.length - 1, nearestRungIndex(ladder, price) + ticks);
  return ladder[targetIndex]!;
}

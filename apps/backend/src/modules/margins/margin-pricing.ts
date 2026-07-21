/**
 * A feed price this low would need a margin over 99% to push its implied
 * probability to 1 - clamping here keeps applyMargin from ever producing
 * odds <= 1.00 (or negative/infinite) for a valid marginPercent in [0,100].
 */
const MAX_IMPLIED_PROBABILITY = 0.99;

/**
 * Applies a trading margin to a single feed price: convert to implied
 * probability, add the margin (a straight percentage-point bump - 20%
 * margin on a 50% implied-probability price becomes 70%), convert back to
 * decimal odds. This is how the extra probability the book prices in
 * (its edge) is expressed as shorter odds for the player, rather than a
 * flat cut off the decimal price itself.
 */
export function applyMargin(oddsFeed: number, marginPercent: number): number {
  if (marginPercent <= 0) {
    return oddsFeed;
  }
  const impliedProbability = 1 / oddsFeed;
  const adjustedProbability = Math.min(impliedProbability + marginPercent / 100, MAX_IMPLIED_PROBABILITY);
  const adjustedOdds = 1 / adjustedProbability;
  return Math.round(adjustedOdds * 100) / 100;
}

/** Composite key for looking up a MarginConfig row by (tier, marketName) in a Map. */
export function marginConfigKey(tier: number, marketName: string): string {
  return `${tier}:${marketName}`;
}

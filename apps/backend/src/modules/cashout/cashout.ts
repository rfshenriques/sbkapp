export interface CashoutConfigValues {
  enabled: boolean;
  /** The operator's own cut, applied even when the combined odds haven't moved at all. */
  marginPercent: number;
}

export interface CashoutLeg {
  /** The odds this leg was actually placed at (BetSelection.odds). */
  originalOdds: number;
  /** The odds this same selection trades at right now - null when it can no longer be priced (match/market/selection missing from the live feed, or currently suspended). */
  currentOdds: number | null;
}

export interface CashoutQuote {
  originalCombinedOdds: number;
  currentCombinedOdds: number;
  /** What the player would be credited if they cash out right now. */
  cashoutValueCents: number;
}

/** Every leg must still be priceable for a quote to mean anything - a match/selection that's disappeared or is suspended has no reliable current price. */
export function allLegsPriceable(legs: CashoutLeg[]): boolean {
  return legs.every((leg) => leg.currentOdds !== null);
}

/**
 * Stake x (originalCombinedOdds / currentCombinedOdds) x (1 - margin%) - the
 * combined odds are the product across every leg (a single bet is just the
 * one-leg case), each priced off its own live current odds, per the
 * accumulator rule that every selection counts, not just one. Odds
 * shortening (current < original) pays out more than the stake; odds
 * drifting (current > original) pays out less; odds that haven't moved at
 * all - including a match that hasn't kicked off yet - leave the ratio at
 * 1, reducing to exactly stake x (1 - margin%): the operator's cut is never
 * skipped, even at breakeven. Callers must check allLegsPriceable first;
 * an unpriceable leg here is simply treated as unmoved rather than
 * blocking the math, so this function is total.
 */
export function calculateCashoutQuote(stakeCents: number, legs: CashoutLeg[], config: CashoutConfigValues): CashoutQuote {
  const originalCombinedOdds = legs.reduce((product, leg) => product * leg.originalOdds, 1);
  const currentCombinedOdds = legs.reduce((product, leg) => product * (leg.currentOdds ?? leg.originalOdds), 1);
  const raw = stakeCents * (originalCombinedOdds / currentCombinedOdds) * (1 - config.marginPercent / 100);
  return {
    originalCombinedOdds,
    currentCombinedOdds,
    cashoutValueCents: Math.max(0, Math.round(raw)),
  };
}

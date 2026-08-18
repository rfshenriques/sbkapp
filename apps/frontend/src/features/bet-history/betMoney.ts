import type { PlacedBet } from '../../lib/backendApi';

/**
 * combinedOdds/potentialPayoutCents already have any acca boost/insurance
 * baked in as of placement time (see PamService.placeBet) - the
 * pre-boost/pre-insurance values are re-derived here rather than stored
 * redundantly, same "recompute, don't trust a stored derived value"
 * convention PamService.settleSelection itself follows.
 */
export function unboostedCombinedOdds(bet: PlacedBet): number {
  return Number(bet.combinedOdds) / (1 + bet.accaBoostPercent / 100);
}

export function displayedPayoutCents(bet: PlacedBet): number {
  if (bet.status === 'PENDING') return bet.potentialPayoutCents;
  if (bet.status === 'CASHED_OUT') return bet.cashedOutValueCents ?? 0;
  return bet.settledPayoutCents ?? 0;
}

export function uninsuredPayoutCents(bet: PlacedBet): number {
  return Math.round(displayedPayoutCents(bet) / (1 - bet.insuranceCostPercent / 100));
}

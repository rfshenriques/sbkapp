import type { SelectionStatus } from '@prisma/client';

export interface SettlementSelectionInput {
  status: SelectionStatus;
  odds: number;
}

/** Never CASHED_OUT - that status is only ever set directly by PamService.cashOut, never derived from leg outcomes. */
export type SettlementBetStatus = 'WON' | 'LOST' | 'VOID' | 'PENDING';

export interface SettlementOutcome {
  overallStatus: SettlementBetStatus;
  /** 0 when LOST or still PENDING; the amount to credit otherwise. */
  payoutCents: number;
}

/**
 * Combo-bet settlement rules:
 * - Any LOST leg kills the whole bet immediately, regardless of the others -
 *   no partial payout for the legs that already won or are still open.
 * - Any leg still OPEN means the bet isn't fully graded yet (PENDING).
 * - A VOID leg is treated as 1.00 odds - excluded from the multiplier, not
 *   given its own slice of the stake back. The bet's payout is the *full*
 *   original stake times the recalculated product of the remaining legs'
 *   odds; if every leg is VOID that product is 1, so the whole stake comes
 *   back as a side effect of the same formula, not a special case.
 * - Otherwise, all legs are settled and none LOST: WON, paying out the
 *   stake times the product of the non-void legs' odds.
 *
 * Settling one selection never touches any other selection's own status -
 * a leg that's already WON stays WON in its own record even if a sibling
 * leg later settles LOST and kills the bet overall.
 *
 * `boostPercent` is the acca boost (see acca-boost.ts) locked in at
 * placement time - applied on top of the recomputed effective odds so a
 * boosted accumulator still pays the boosted amount even after some legs
 * void, rather than silently losing the boost.
 */
export function computeBetOutcome(
  selections: SettlementSelectionInput[],
  stakeCents: number,
  boostPercent = 0,
): SettlementOutcome {
  if (selections.some((selection) => selection.status === 'LOST')) {
    return { overallStatus: 'LOST', payoutCents: 0 };
  }
  if (selections.some((selection) => selection.status === 'OPEN')) {
    return { overallStatus: 'PENDING', payoutCents: 0 };
  }
  if (selections.every((selection) => selection.status === 'VOID')) {
    return { overallStatus: 'VOID', payoutCents: stakeCents };
  }

  const effectiveOdds = selections.reduce(
    (total, selection) => (selection.status === 'VOID' ? total : total * selection.odds),
    1,
  );
  const boostedOdds = effectiveOdds * (1 + boostPercent / 100);
  return { overallStatus: 'WON', payoutCents: Math.round(stakeCents * boostedOdds) };
}

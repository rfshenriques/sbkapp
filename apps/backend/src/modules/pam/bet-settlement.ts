import type { BetStatus, SelectionStatus } from '@prisma/client';

export interface SettlementSelectionInput {
  status: SelectionStatus;
  odds: number;
}

export interface SettlementOutcome {
  overallStatus: BetStatus;
  /** 0 when LOST or still PENDING; the amount to credit otherwise. */
  payoutCents: number;
}

/**
 * Combo-bet settlement rules:
 * - Any LOST leg kills the whole bet immediately, regardless of the others.
 * - Any leg still OPEN means the bet isn't fully graded yet (PENDING).
 * - A VOID leg counts as 1.00 odds (effectively removed from the multiplier)
 *   and its stake portion is returned - if every leg is VOID, the whole
 *   stake comes back.
 * - Otherwise, all legs are settled and none LOST: WON, paying out the
 *   stake times the product of the non-void legs' odds.
 */
export function computeBetOutcome(
  selections: SettlementSelectionInput[],
  stakeCents: number,
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
  return { overallStatus: 'WON', payoutCents: Math.round(stakeCents * effectiveOdds) };
}

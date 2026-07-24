export interface AccaRollbackConfigValues {
  minSelections: number;
  lossThreshold: number;
  /** e.g. 100 for a full stake refund, 50 for half - always paid as a freebet, never cash. */
  rewardPercent: number;
  enabled: boolean;
}

export interface AccaRollbackEligibility {
  qualifies: boolean;
}

/**
 * Pre-placement bet-slip hint, based on leg count alone (the only thing
 * knowable before any leg has an outcome) - mirrors AccaBoostBar's
 * "N more selections needed" progress message.
 */
export function evaluateAccaRollbackEligibility(
  selectionCount: number,
  config: AccaRollbackConfigValues,
): AccaRollbackEligibility {
  return { qualifies: config.enabled && selectionCount >= config.minSelections };
}

export interface AccaRollbackReward {
  qualifies: boolean;
  rewardCents: number;
}

/**
 * Settlement-time reward calculation - only meaningful once every leg is
 * terminal (WON/LOST/VOID), since a bet already lost the moment its first
 * leg lost but siblings may still be OPEN. Callers must count lostLegCount
 * only after selections.every(s => s.status !== 'OPEN'), otherwise a leg
 * that later loses too could be undercounted and grant a reward the bet
 * didn't actually qualify for.
 */
export function calculateAccaRollbackReward(
  legCount: number,
  lostLegCount: number,
  stakeCents: number,
  config: AccaRollbackConfigValues,
): AccaRollbackReward {
  const qualifies =
    config.enabled &&
    legCount >= config.minSelections &&
    lostLegCount >= 1 &&
    lostLegCount <= config.lossThreshold;

  if (!qualifies) {
    return { qualifies: false, rewardCents: 0 };
  }

  const rewardCents = Math.round((stakeCents * config.rewardPercent) / 100);
  return { qualifies: true, rewardCents };
}

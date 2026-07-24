/**
 * Client-side mirror of the backend's acca-rollback.ts eligibility check -
 * used for the bet slip's pre-placement hint only. The actual reward (see
 * apps/backend's calculateAccaRollbackReward) depends on how many legs end
 * up losing, which isn't knowable until settlement - so this only tells the
 * player whether their accumulator has enough legs to be in the running.
 */
export interface AccaRollbackConfig {
  minSelections: number;
  lossThreshold: number;
  rewardPercent: number;
  enabled: boolean;
}

export interface AccaRollbackEligibility {
  qualifies: boolean;
}

export function evaluateAccaRollbackEligibility(
  selectionCount: number,
  config: AccaRollbackConfig,
): AccaRollbackEligibility {
  return { qualifies: config.enabled && selectionCount >= config.minSelections };
}

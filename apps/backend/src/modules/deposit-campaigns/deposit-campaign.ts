export interface DepositRewardRules {
  minDepositAmountCents: number;
  rewardType: 'FIXED' | 'PERCENTAGE';
  fixedRewardAmountCents: number | null;
  rewardPercent: number | null;
  rewardCapCents: number | null;
}

/**
 * The freebet amount a qualifying deposit earns, or null when the deposit
 * doesn't meet the campaign's minimum. FIXED always pays the same amount;
 * PERCENTAGE pays a share of the deposit itself, capped so a very large
 * deposit can't produce an unbounded reward.
 */
export function computeDepositReward(rules: DepositRewardRules, depositAmountCents: number): number | null {
  if (depositAmountCents < rules.minDepositAmountCents) {
    return null;
  }

  if (rules.rewardType === 'FIXED') {
    return rules.fixedRewardAmountCents!;
  }

  const uncapped = Math.round((depositAmountCents * rules.rewardPercent!) / 100);
  return Math.min(uncapped, rules.rewardCapCents!);
}

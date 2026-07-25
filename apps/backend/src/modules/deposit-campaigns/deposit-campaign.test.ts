import { describe, expect, it } from 'vitest';
import { computeDepositReward, type DepositRewardRules } from './deposit-campaign';

describe('computeDepositReward', () => {
  it('returns null when the deposit is below the minimum', () => {
    const rules: DepositRewardRules = {
      minDepositAmountCents: 5000,
      rewardType: 'FIXED',
      fixedRewardAmountCents: 1000,
      rewardPercent: null,
      rewardCapCents: null,
    };
    expect(computeDepositReward(rules, 4999)).toBeNull();
  });

  it('pays the flat amount for FIXED once the minimum is met', () => {
    const rules: DepositRewardRules = {
      minDepositAmountCents: 5000,
      rewardType: 'FIXED',
      fixedRewardAmountCents: 1000,
      rewardPercent: null,
      rewardCapCents: null,
    };
    expect(computeDepositReward(rules, 5000)).toBe(1000);
    expect(computeDepositReward(rules, 50000)).toBe(1000);
  });

  it('pays a percentage of the deposit for PERCENTAGE, uncapped case', () => {
    const rules: DepositRewardRules = {
      minDepositAmountCents: 1000,
      rewardType: 'PERCENTAGE',
      fixedRewardAmountCents: null,
      rewardPercent: 50,
      rewardCapCents: 100000,
    };
    expect(computeDepositReward(rules, 2000)).toBe(1000);
  });

  it('caps the PERCENTAGE reward at rewardCapCents', () => {
    const rules: DepositRewardRules = {
      minDepositAmountCents: 1000,
      rewardType: 'PERCENTAGE',
      fixedRewardAmountCents: null,
      rewardPercent: 50,
      rewardCapCents: 5000,
    };
    expect(computeDepositReward(rules, 100000)).toBe(5000);
  });

  it('rounds a fractional percentage result to the nearest cent', () => {
    const rules: DepositRewardRules = {
      minDepositAmountCents: 100,
      rewardType: 'PERCENTAGE',
      fixedRewardAmountCents: null,
      rewardPercent: 33,
      rewardCapCents: 100000,
    };
    expect(computeDepositReward(rules, 999)).toBe(330);
  });
});

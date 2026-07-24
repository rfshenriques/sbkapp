import { describe, expect, it } from 'vitest';
import {
  calculateAccaRollbackReward,
  evaluateAccaRollbackEligibility,
  type AccaRollbackConfigValues,
} from './acca-rollback';

const config: AccaRollbackConfigValues = {
  minSelections: 3,
  lossThreshold: 1,
  rewardPercent: 100,
  enabled: true,
};

describe('evaluateAccaRollbackEligibility', () => {
  it('does not qualify below minSelections', () => {
    expect(evaluateAccaRollbackEligibility(2, config).qualifies).toBe(false);
  });

  it('qualifies at or above minSelections', () => {
    expect(evaluateAccaRollbackEligibility(3, config).qualifies).toBe(true);
    expect(evaluateAccaRollbackEligibility(4, config).qualifies).toBe(true);
  });

  it('does not qualify when disabled', () => {
    expect(evaluateAccaRollbackEligibility(5, { ...config, enabled: false }).qualifies).toBe(false);
  });
});

describe('calculateAccaRollbackReward', () => {
  it('does not qualify when nothing lost', () => {
    const result = calculateAccaRollbackReward(4, 0, 1000, config);

    expect(result.qualifies).toBe(false);
    expect(result.rewardCents).toBe(0);
  });

  it('does not qualify when more legs lost than lossThreshold', () => {
    const result = calculateAccaRollbackReward(4, 2, 1000, config);

    expect(result.qualifies).toBe(false);
  });

  it('does not qualify below minSelections even with a single lost leg', () => {
    const result = calculateAccaRollbackReward(2, 1, 1000, config);

    expect(result.qualifies).toBe(false);
  });

  it('does not qualify when disabled', () => {
    const result = calculateAccaRollbackReward(4, 1, 1000, { ...config, enabled: false });

    expect(result.qualifies).toBe(false);
  });

  it('qualifies and refunds rewardPercent of the stake when exactly one leg lost', () => {
    const result = calculateAccaRollbackReward(4, 1, 1000, config);

    expect(result.qualifies).toBe(true);
    expect(result.rewardCents).toBe(1000);
  });

  it('refunds a partial percent when rewardPercent < 100', () => {
    const result = calculateAccaRollbackReward(4, 1, 1000, { ...config, rewardPercent: 50 });

    expect(result.qualifies).toBe(true);
    expect(result.rewardCents).toBe(500);
  });

  it('rounds the reward to the nearest cent', () => {
    const result = calculateAccaRollbackReward(4, 1, 999, { ...config, rewardPercent: 33 });

    expect(result.rewardCents).toBe(330);
  });

  it('allows a higher lossThreshold to tolerate more losing legs', () => {
    const result = calculateAccaRollbackReward(5, 2, 1000, { ...config, lossThreshold: 2 });

    expect(result.qualifies).toBe(true);
  });
});

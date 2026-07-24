import { describe, expect, it } from 'vitest';
import { calculateInsuredPayout, type InsuranceBetConfigValues } from './insurance-bet';

const config: InsuranceBetConfigValues = {
  costPercent: 10,
  enabled: true,
};

describe('calculateInsuredPayout', () => {
  it('passes the raw payout through unchanged when the player did not opt in', () => {
    const result = calculateInsuredPayout(1000, false, config);

    expect(result.costPercent).toBe(0);
    expect(result.insuredPayoutCents).toBe(1000);
  });

  it('passes the raw payout through unchanged when insurance is disabled for the brand, even if opted in', () => {
    const result = calculateInsuredPayout(1000, true, { ...config, enabled: false });

    expect(result.costPercent).toBe(0);
    expect(result.insuredPayoutCents).toBe(1000);
  });

  it('deducts costPercent from the payout when opted in and enabled', () => {
    const result = calculateInsuredPayout(1000, true, config);

    expect(result.costPercent).toBe(10);
    expect(result.insuredPayoutCents).toBe(900);
  });

  it('rounds the insured payout to the nearest cent', () => {
    const result = calculateInsuredPayout(999, true, { ...config, costPercent: 33 });

    expect(result.insuredPayoutCents).toBe(669);
  });

  it('supports a 0% cost as a no-op reduction while still marking it as opted in', () => {
    const result = calculateInsuredPayout(1000, true, { ...config, costPercent: 0 });

    expect(result.costPercent).toBe(0);
    expect(result.insuredPayoutCents).toBe(1000);
  });
});

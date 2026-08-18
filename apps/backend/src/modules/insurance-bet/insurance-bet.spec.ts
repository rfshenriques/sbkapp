import { describe, expect, it } from 'vitest';
import { calculateInsuredPayout, meetsInsuranceMinOdds, type InsuranceBetConfigValues } from './insurance-bet';

const config: InsuranceBetConfigValues = {
  costPercent: 10,
  enabled: true,
  minOdds: 1,
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

describe('meetsInsuranceMinOdds', () => {
  it('is true when combined odds exactly equal the floor', () => {
    expect(meetsInsuranceMinOdds(1.5, { ...config, minOdds: 1.5 })).toBe(true);
  });

  it('is true when combined odds exceed the floor', () => {
    expect(meetsInsuranceMinOdds(2.5, { ...config, minOdds: 1.5 })).toBe(true);
  });

  it('is false when combined odds fall short of the floor', () => {
    expect(meetsInsuranceMinOdds(1.4, { ...config, minOdds: 1.5 })).toBe(false);
  });

  it('is true for any real combined odds when the floor is left at its default of 1', () => {
    expect(meetsInsuranceMinOdds(1.01, config)).toBe(true);
  });
});

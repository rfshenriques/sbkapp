import { describe, expect, it } from 'vitest';
import { campaignPromoStatus } from './promo-card-status';

const NOW = new Date('2026-07-27T12:00:00Z');

describe('campaignPromoStatus', () => {
  it('is ACTIVE for a card with no linked campaign at all', () => {
    expect(campaignPromoStatus(null, NOW)).toBe('ACTIVE');
  });

  it('is ACTIVE when enabled with no scheduling window', () => {
    expect(campaignPromoStatus({ enabled: true, startAt: null, endAt: null }, NOW)).toBe('ACTIVE');
  });

  it('is ACTIVE when enabled and currently within its window', () => {
    expect(
      campaignPromoStatus(
        {
          enabled: true,
          startAt: new Date('2026-07-01T00:00:00Z'),
          endAt: new Date('2026-08-01T00:00:00Z'),
        },
        NOW,
      ),
    ).toBe('ACTIVE');
  });

  it('is DISABLED when not enabled, regardless of dates', () => {
    expect(campaignPromoStatus({ enabled: false, startAt: null, endAt: null }, NOW)).toBe('DISABLED');
  });

  it('is DISABLED when enabled but not yet started', () => {
    expect(
      campaignPromoStatus({ enabled: true, startAt: new Date('2026-08-01T00:00:00Z'), endAt: null }, NOW),
    ).toBe('DISABLED');
  });

  it('is EARLY_ENDED when enabled, started, but endAt has passed', () => {
    expect(
      campaignPromoStatus({ enabled: true, startAt: null, endAt: new Date('2026-07-01T00:00:00Z') }, NOW),
    ).toBe('EARLY_ENDED');
  });

  it('is DISABLED, not EARLY_ENDED, when both disabled and past endAt', () => {
    expect(
      campaignPromoStatus({ enabled: false, startAt: null, endAt: new Date('2026-07-01T00:00:00Z') }, NOW),
    ).toBe('DISABLED');
  });
});

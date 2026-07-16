import { describe, expect, it } from 'vitest';
import { EVENT_NAMES } from './contracts';

describe('EVENT_NAMES', () => {
  it('has a unique event name for every entry', () => {
    const values = Object.values(EVENT_NAMES);
    expect(new Set(values).size).toBe(values.length);
  });

  it('covers the Section 9 cross-module events', () => {
    expect(EVENT_NAMES.RISK_MARKET_AUTO_LOCKED).toBe('risk.market.auto_locked');
    expect(EVENT_NAMES.RISK_ALERT_RAISED).toBe('risk.alert.raised');
    expect(EVENT_NAMES.FRAUD_FLAG_RAISED).toBe('fraud.flag.raised');
    expect(EVENT_NAMES.PAM_FLAG_RECORDED).toBe('pam.flag.recorded');
    expect(EVENT_NAMES.CRM_SEGMENT_CHANGED).toBe('crm.segment.changed');
    expect(EVENT_NAMES.ACTIVE_OFFER_RESOLVED).toBe('offers.active_offer.resolved');
    expect(EVENT_NAMES.TRADING_BET_SETTLED).toBe('trading.bet.settled');
    expect(EVENT_NAMES.NOTIFICATION_DISPATCH_REQUESTED).toBe('notification.dispatch_requested');
  });
});

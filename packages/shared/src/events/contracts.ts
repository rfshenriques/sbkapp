/**
 * Cross-module event contracts (see docs/PROJECT_BRIEF.md, Section 9).
 *
 * Payload shapes are intentionally empty placeholders. Each gets filled in
 * when its owning module's detailed spec is written under docs/modules/ —
 * do not guess business fields here ahead of that.
 */

export interface DomainEvent<TName extends EventName = EventName> {
  id: string;
  name: TName;
  occurredAt: string;
  payload: EventPayloadMap[TName];
}

export const EVENT_NAMES = {
  /** Risk → Trading: a market/selection must be locked immediately (synchronous). */
  RISK_MARKET_AUTO_LOCKED: 'risk.market.auto_locked',
  /** Risk → Admin/backoffice: alert accompanying every auto-lock. */
  RISK_ALERT_RAISED: 'risk.alert.raised',
  /** Fraud → PAM: a fraud flag lands on a player's record. */
  FRAUD_FLAG_RAISED: 'fraud.flag.raised',
  /** Any module → PAM: a flag or note is recorded on a player's account. */
  PAM_FLAG_RECORDED: 'pam.flag.recorded',
  /** CRM → CMS: a player's segment membership changed. */
  CRM_SEGMENT_CHANGED: 'crm.segment.changed',
  /** Shared resolver: which campaign (CRM vs. Bonus) applies for a player. */
  ACTIVE_OFFER_RESOLVED: 'offers.active_offer.resolved',
  /** Trading (settlement) → Wallet/PAM: a bet has been settled. */
  TRADING_BET_SETTLED: 'trading.bet.settled',
  /** Any module → Notifications: request to dispatch an email/push/SMS/in-app message. */
  NOTIFICATION_DISPATCH_REQUESTED: 'notification.dispatch_requested',
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

export type RiskMarketAutoLockedPayload = Record<string, never>;
export type RiskAlertRaisedPayload = Record<string, never>;
export type FraudFlagRaisedPayload = Record<string, never>;
export type PamFlagRecordedPayload = Record<string, never>;
export type CrmSegmentChangedPayload = Record<string, never>;
export type ActiveOfferResolvedPayload = Record<string, never>;
export type TradingBetSettledPayload = Record<string, never>;
export type NotificationDispatchRequestedPayload = Record<string, never>;

export interface EventPayloadMap {
  [EVENT_NAMES.RISK_MARKET_AUTO_LOCKED]: RiskMarketAutoLockedPayload;
  [EVENT_NAMES.RISK_ALERT_RAISED]: RiskAlertRaisedPayload;
  [EVENT_NAMES.FRAUD_FLAG_RAISED]: FraudFlagRaisedPayload;
  [EVENT_NAMES.PAM_FLAG_RECORDED]: PamFlagRecordedPayload;
  [EVENT_NAMES.CRM_SEGMENT_CHANGED]: CrmSegmentChangedPayload;
  [EVENT_NAMES.ACTIVE_OFFER_RESOLVED]: ActiveOfferResolvedPayload;
  [EVENT_NAMES.TRADING_BET_SETTLED]: TradingBetSettledPayload;
  [EVENT_NAMES.NOTIFICATION_DISPATCH_REQUESTED]: NotificationDispatchRequestedPayload;
}

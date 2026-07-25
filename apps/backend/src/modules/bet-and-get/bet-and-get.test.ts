import { describe, expect, it } from 'vitest';
import {
  betQualifiesForCampaign,
  isCampaignScheduledActive,
  matchIsInCampaignScope,
  type CampaignConditions,
  type CampaignScope,
} from './bet-and-get';

const NO_CONDITIONS: CampaignConditions = {
  minStakeCents: null,
  minOddsPerLeg: null,
  betType: 'EITHER',
  minSelections: null,
};

describe('matchIsInCampaignScope', () => {
  const match = { sport: 'Football', competition: 'Champions League', matchId: 'match-1' };

  it('matches a SPORT scope by sport name', () => {
    const scopes: CampaignScope[] = [{ scopeType: 'SPORT', scopeValue: 'Football' }];
    expect(matchIsInCampaignScope(scopes, match)).toBe(true);
  });

  it('matches a COMPETITION scope by competition name', () => {
    const scopes: CampaignScope[] = [{ scopeType: 'COMPETITION', scopeValue: 'Champions League' }];
    expect(matchIsInCampaignScope(scopes, match)).toBe(true);
  });

  it('matches a MATCH scope by matchId', () => {
    const scopes: CampaignScope[] = [{ scopeType: 'MATCH', scopeValue: 'match-1' }];
    expect(matchIsInCampaignScope(scopes, match)).toBe(true);
  });

  it('is false when no scope matches', () => {
    const scopes: CampaignScope[] = [
      { scopeType: 'SPORT', scopeValue: 'Basketball' },
      { scopeType: 'COMPETITION', scopeValue: 'Premier League' },
      { scopeType: 'MATCH', scopeValue: 'match-2' },
    ];
    expect(matchIsInCampaignScope(scopes, match)).toBe(false);
  });

  it('is false for an empty scope list - never treated as "everything"', () => {
    expect(matchIsInCampaignScope([], match)).toBe(false);
  });

  it('is true if any one of several scopes matches (union, not intersection)', () => {
    const scopes: CampaignScope[] = [
      { scopeType: 'SPORT', scopeValue: 'Basketball' },
      { scopeType: 'COMPETITION', scopeValue: 'Champions League' },
    ];
    expect(matchIsInCampaignScope(scopes, match)).toBe(true);
  });
});

describe('isCampaignScheduledActive', () => {
  const now = new Date('2026-06-15T12:00:00Z');

  it('is false when disabled, regardless of the window', () => {
    expect(isCampaignScheduledActive({ enabled: false, startAt: null, endAt: null }, now)).toBe(false);
  });

  it('is true when enabled with no window set', () => {
    expect(isCampaignScheduledActive({ enabled: true, startAt: null, endAt: null }, now)).toBe(true);
  });

  it('is false before startAt, true once reached', () => {
    const future = new Date('2026-06-16T00:00:00Z');
    const past = new Date('2026-06-01T00:00:00Z');
    expect(isCampaignScheduledActive({ enabled: true, startAt: future, endAt: null }, now)).toBe(false);
    expect(isCampaignScheduledActive({ enabled: true, startAt: past, endAt: null }, now)).toBe(true);
  });

  it('is false after endAt, true up to and including it', () => {
    const past = new Date('2026-06-01T00:00:00Z');
    const future = new Date('2026-06-16T00:00:00Z');
    expect(isCampaignScheduledActive({ enabled: true, startAt: null, endAt: past }, now)).toBe(false);
    expect(isCampaignScheduledActive({ enabled: true, startAt: null, endAt: future }, now)).toBe(true);
  });

  it('requires now to fall inside both boundaries when both are set', () => {
    const start = new Date('2026-06-10T00:00:00Z');
    const end = new Date('2026-06-20T00:00:00Z');
    expect(isCampaignScheduledActive({ enabled: true, startAt: start, endAt: end }, now)).toBe(true);
    expect(isCampaignScheduledActive({ enabled: true, startAt: start, endAt: new Date('2026-06-12T00:00:00Z') }, now)).toBe(
      false,
    );
  });
});

describe('betQualifiesForCampaign', () => {
  it('qualifies with no conditions configured', () => {
    expect(betQualifiesForCampaign(NO_CONDITIONS, { stakeCents: 1, legOdds: [1.01] })).toBe(true);
  });

  it('rejects a stake below minStakeCents', () => {
    const conditions = { ...NO_CONDITIONS, minStakeCents: 1_000 };
    expect(betQualifiesForCampaign(conditions, { stakeCents: 999, legOdds: [2.0] })).toBe(false);
    expect(betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0] })).toBe(true);
  });

  it('rejects if any leg is under minOddsPerLeg', () => {
    const conditions = { ...NO_CONDITIONS, minOddsPerLeg: 1.5 };
    expect(betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0, 1.4] })).toBe(false);
    expect(betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0, 1.5] })).toBe(true);
  });

  it('SINGLES_ONLY rejects an accumulator', () => {
    const conditions = { ...NO_CONDITIONS, betType: 'SINGLES_ONLY' as const };
    expect(betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0, 2.0] })).toBe(false);
    expect(betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0] })).toBe(true);
  });

  it('ACCUMULATOR_ONLY rejects a single', () => {
    const conditions = { ...NO_CONDITIONS, betType: 'ACCUMULATOR_ONLY' as const };
    expect(betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0] })).toBe(false);
    expect(betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0, 2.0] })).toBe(true);
  });

  it('rejects an accumulator under minSelections', () => {
    const conditions = { ...NO_CONDITIONS, minSelections: 3 };
    expect(betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0, 2.0] })).toBe(false);
    expect(betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0, 2.0, 2.0] })).toBe(true);
  });

  it('minSelections never rejects a single leg bet on its own', () => {
    const conditions = { ...NO_CONDITIONS, minSelections: 3 };
    expect(betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0] })).toBe(true);
  });

  it('requires every configured condition to pass together', () => {
    const conditions: CampaignConditions = {
      minStakeCents: 1_000,
      minOddsPerLeg: 1.5,
      betType: 'ACCUMULATOR_ONLY',
      minSelections: 3,
    };
    expect(
      betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0, 2.0, 2.0] }),
    ).toBe(true);
    expect(
      betQualifiesForCampaign(conditions, { stakeCents: 999, legOdds: [2.0, 2.0, 2.0] }),
    ).toBe(false);
    expect(
      betQualifiesForCampaign(conditions, { stakeCents: 1_000, legOdds: [2.0, 2.0] }),
    ).toBe(false);
  });
});

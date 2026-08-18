import { describe, expect, it } from 'vitest';
import type { PlacedBet } from '../../lib/backendApi';
import { sortBetsForHistory } from './sortBetsForHistory';

function buildBet(overrides: Partial<PlacedBet> = {}): PlacedBet {
  return {
    id: 'bet-1',
    stakeCents: 1000,
    combinedOdds: '2.00',
    potentialPayoutCents: 2000,
    status: 'PENDING',
    settledPayoutCents: null,
    settledAt: null,
    createdAt: '2026-07-19T10:00:00Z',
    fundedByFreebets: false,
    insuranceCostPercent: 0,
    accaBoostPercent: 0,
    betAndGetCampaignName: null,
    betAndGetCampaignRewardCents: null,
    depositCampaignName: null,
    depositCampaignRewardCents: null,
    registerCampaignName: null,
    registerCampaignRewardCents: null,
    accaRollbackRewardCents: null,
    cashedOutValueCents: null,
    cashedOutAt: null,
    selections: [],
    ...overrides,
  };
}

describe('sortBetsForHistory', () => {
  it('puts open (PENDING) bets before settled ones regardless of recency', () => {
    const bets = [
      buildBet({ id: 'settled-newer', status: 'WON', createdAt: '2026-07-19T12:00:00Z' }),
      buildBet({ id: 'open-older', status: 'PENDING', createdAt: '2026-07-18T09:00:00Z' }),
    ];

    expect(sortBetsForHistory(bets).map((bet) => bet.id)).toEqual(['open-older', 'settled-newer']);
  });

  it('sorts most recent first within each group', () => {
    const bets = [
      buildBet({ id: 'older-open', status: 'PENDING', createdAt: '2026-07-18T09:00:00Z' }),
      buildBet({ id: 'newer-open', status: 'PENDING', createdAt: '2026-07-19T09:00:00Z' }),
      buildBet({ id: 'older-settled', status: 'LOST', createdAt: '2026-07-17T09:00:00Z' }),
      buildBet({ id: 'newer-settled', status: 'WON', createdAt: '2026-07-18T09:00:00Z' }),
    ];

    expect(sortBetsForHistory(bets).map((bet) => bet.id)).toEqual([
      'newer-open',
      'older-open',
      'newer-settled',
      'older-settled',
    ]);
  });
});

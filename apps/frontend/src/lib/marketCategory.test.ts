import { describe, expect, it } from 'vitest';
import { groupMarketsByCategory, marketCategory } from './marketCategory';

describe('marketCategory', () => {
  it('categorizes total-goals markets as totals', () => {
    expect(marketCategory({ id: 'total-goals-2.5' })).toBe('totals');
  });

  it('categorizes handicap markets as handicaps', () => {
    expect(marketCategory({ id: 'handicap--1' })).toBe('handicaps');
  });

  it('falls back to main for match result, double chance, and manual markets', () => {
    expect(marketCategory({ id: 'match-result' })).toBe('main');
    expect(marketCategory({ id: 'double-chance' })).toBe('main');
    expect(marketCategory({ id: 'both-teams-to-score' })).toBe('main');
    expect(marketCategory({ id: 'manual-1' })).toBe('main');
  });
});

describe('groupMarketsByCategory', () => {
  it('splits a mixed market list into its three buckets, preserving order within each', () => {
    const markets = [
      { id: 'match-result' },
      { id: 'total-goals-2.5' },
      { id: 'handicap--1' },
      { id: 'double-chance' },
      { id: 'total-goals-1.5' },
    ];

    expect(groupMarketsByCategory(markets)).toEqual({
      main: [{ id: 'match-result' }, { id: 'double-chance' }],
      totals: [{ id: 'total-goals-2.5' }, { id: 'total-goals-1.5' }],
      handicaps: [{ id: 'handicap--1' }],
    });
  });

  it('returns empty arrays for categories with no markets', () => {
    expect(groupMarketsByCategory([{ id: 'match-result' }])).toEqual({
      main: [{ id: 'match-result' }],
      totals: [],
      handicaps: [],
    });
  });
});

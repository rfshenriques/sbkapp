import { describe, expect, it } from 'vitest';
import { mockMatches } from './matches';

describe('mockMatches', () => {
  it('has at least one match', () => {
    expect(mockMatches.length).toBeGreaterThan(0);
  });

  it('has unique match ids', () => {
    const ids = mockMatches.map((match) => match.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every match at least one market with at least two selections', () => {
    for (const match of mockMatches) {
      expect(match.markets.length).toBeGreaterThan(0);
      for (const market of match.markets) {
        expect(market.selections.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

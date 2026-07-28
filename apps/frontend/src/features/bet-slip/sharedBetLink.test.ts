import { describe, expect, it } from 'vitest';
import { buildSharedBetUrl, decodeSharedBetSelections, encodeSharedBetSelections } from './sharedBetLink';

describe('sharedBetLink', () => {
  it('round-trips a single selection through encode/decode', () => {
    const refs = [{ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' }];

    expect(decodeSharedBetSelections(encodeSharedBetSelections(refs))).toEqual(refs);
  });

  it('round-trips several selections through encode/decode', () => {
    const refs = [
      { matchId: 'match-1', marketId: 'match-result', selectionId: 'home' },
      { matchId: 'match-2', marketId: 'total-goals', selectionId: 'over-2-5' },
    ];

    expect(decodeSharedBetSelections(encodeSharedBetSelections(refs))).toEqual(refs);
  });

  it('returns null for an empty or missing param', () => {
    expect(decodeSharedBetSelections('')).toBeNull();
  });

  it('returns null for a malformed param instead of throwing', () => {
    expect(decodeSharedBetSelections('not-a-valid-ref')).toBeNull();
    expect(decodeSharedBetSelections('match-1~market-1')).toBeNull();
  });

  it('builds an absolute /shared-bet URL carrying the encoded selections', () => {
    const refs = [{ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' }];

    const url = buildSharedBetUrl(refs);

    expect(url).toContain('/shared-bet?sel=');
    const parsed = new URL(url);
    expect(decodeSharedBetSelections(parsed.searchParams.get('sel')!)).toEqual(refs);
  });
});

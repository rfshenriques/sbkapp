import { describe, expect, it } from 'vitest';
import { normalizeDomain } from './normalize-domain';

describe('normalizeDomain', () => {
  it('lowercases the domain', () => {
    expect(normalizeDomain('BetSome.PT')).toBe('betsome.pt');
  });

  it('strips a leading www.', () => {
    expect(normalizeDomain('www.betsome.pt')).toBe('betsome.pt');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeDomain('  betsome.pt  ')).toBe('betsome.pt');
  });

  it('leaves an already-normalized domain unchanged', () => {
    expect(normalizeDomain('betsome.pt')).toBe('betsome.pt');
  });

  it('only strips a leading www label, not one appearing elsewhere', () => {
    expect(normalizeDomain('mywww.pt')).toBe('mywww.pt');
  });
});

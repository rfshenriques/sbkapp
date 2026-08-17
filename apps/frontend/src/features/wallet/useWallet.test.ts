import { describe, expect, it } from 'vitest';
import { formatCents } from './useWallet';

describe('formatCents', () => {
  it('drops decimals for a whole-euro amount', () => {
    expect(formatCents(4300)).toBe('43');
    expect(formatCents(540000)).toBe('5400');
    expect(formatCents(345600)).toBe('3456');
    expect(formatCents(0)).toBe('0');
  });

  it('keeps 2 decimals for a genuinely fractional amount', () => {
    expect(formatCents(4350)).toBe('43.50');
    expect(formatCents(345601)).toBe('3456.01');
  });
});

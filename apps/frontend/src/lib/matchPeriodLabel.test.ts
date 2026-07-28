import { describe, expect, it } from 'vitest';
import { matchPeriodLabel } from './matchPeriodLabel';

describe('matchPeriodLabel', () => {
  it('maps known provider status codes to a player-facing label', () => {
    expect(matchPeriodLabel('1H')).toBe('1st Half');
    expect(matchPeriodLabel('HT')).toBe('Half-time');
    expect(matchPeriodLabel('2H')).toBe('2nd Half');
    expect(matchPeriodLabel('ET')).toBe('Extra Time');
    expect(matchPeriodLabel('P')).toBe('Penalties');
  });

  it('falls back to the raw code for an unrecognized status', () => {
    expect(matchPeriodLabel('WTF')).toBe('WTF');
  });
});

import { describe, expect, it } from 'vitest';
import { countryFlag } from './countryFlags';

describe('countryFlag', () => {
  it('builds the correct flag emoji for a known country', () => {
    expect(countryFlag('England')).toBe('🇬🇧');
    expect(countryFlag('Spain')).toBe('🇪🇸');
    expect(countryFlag('USA')).toBe('🇺🇸');
  });

  it('falls back to a globe for non-country groupings like World or International', () => {
    expect(countryFlag('World')).toBe('🌍');
    expect(countryFlag('International')).toBe('🌍');
  });

  it('falls back to a globe for an unmapped country', () => {
    expect(countryFlag('Atlantis')).toBe('🌍');
  });
});

import { describe, expect, it } from 'vitest';
import { sportIcon } from './sportIcons';

describe('sportIcon', () => {
  it('returns a distinct icon for each known sport', () => {
    expect(sportIcon('Football')).toBe('⚽');
    expect(sportIcon('Ice Hockey')).toBe('🏒');
    expect(sportIcon('Boxing')).toBe('🥊');
  });

  it('falls back to a generic trophy icon for an unmapped sport', () => {
    expect(sportIcon('Curling')).toBe('🏆');
  });
});

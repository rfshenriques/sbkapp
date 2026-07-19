import { describe, expect, it } from 'vitest';
import type { Selection } from '@sportsbook/shared';
import { sortMatchResultSelections } from './sortMatchResultSelections';

function sel(id: string, name: string): Selection {
  return { id, name, odds: 2 };
}

describe('sortMatchResultSelections', () => {
  it('leaves an already-ordered Home/Draw/Away order unchanged', () => {
    const selections = [sel('home', 'Home'), sel('draw', 'Draw'), sel('away', 'Away')];
    expect(sortMatchResultSelections(selections).map((s) => s.name)).toEqual([
      'Home',
      'Draw',
      'Away',
    ]);
  });

  it('puts Home first and Away last, with Draw centered, however the API orders them', () => {
    const selections = [sel('draw', 'Draw'), sel('away', 'Away'), sel('home', 'Home')];
    expect(sortMatchResultSelections(selections).map((s) => s.name)).toEqual([
      'Home',
      'Draw',
      'Away',
    ]);
  });

  it('puts Home first even when Away comes before it and there is no draw', () => {
    const selections = [sel('away', 'Away'), sel('home', 'Home')];
    expect(sortMatchResultSelections(selections).map((s) => s.name)).toEqual(['Home', 'Away']);
  });

  it('matches "Home"/"Draw"/"Away" case-insensitively', () => {
    const selections = [sel('draw', 'DRAW'), sel('away', 'AWAY'), sel('home', 'HOME')];
    expect(sortMatchResultSelections(selections).map((s) => s.name)).toEqual([
      'HOME',
      'DRAW',
      'AWAY',
    ]);
  });

  it('leaves selections unchanged when there is no recognizable Home/Away pair (e.g. BTTS)', () => {
    const selections = [sel('yes', 'Yes'), sel('no', 'No')];
    expect(sortMatchResultSelections(selections)).toEqual(selections);
  });

  it('leaves selections unchanged when only one of Home/Away is present', () => {
    const selections = [sel('home', 'Home'), sel('over', 'Over 2.5')];
    expect(sortMatchResultSelections(selections)).toEqual(selections);
  });
});

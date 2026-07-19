import { describe, expect, it } from 'vitest';
import type { Selection } from '@sportsbook/shared';
import { sortSelectionsWithDrawInMiddle } from './sortSelectionsWithDrawInMiddle';

function sel(id: string, name: string): Selection {
  return { id, name, odds: 2 };
}

describe('sortSelectionsWithDrawInMiddle', () => {
  it('leaves an already-centered Home/Draw/Away order unchanged', () => {
    const selections = [sel('home', 'Home'), sel('draw', 'Draw'), sel('away', 'Away')];
    expect(sortSelectionsWithDrawInMiddle(selections).map((s) => s.name)).toEqual([
      'Home',
      'Draw',
      'Away',
    ]);
  });

  it('moves Draw to the middle when the API returns it first', () => {
    const selections = [sel('draw', 'Draw'), sel('home', 'Home'), sel('away', 'Away')];
    expect(sortSelectionsWithDrawInMiddle(selections).map((s) => s.name)).toEqual([
      'Home',
      'Draw',
      'Away',
    ]);
  });

  it('moves Draw to the middle when the API returns it last', () => {
    const selections = [sel('home', 'Home'), sel('away', 'Away'), sel('draw', 'Draw')];
    expect(sortSelectionsWithDrawInMiddle(selections).map((s) => s.name)).toEqual([
      'Home',
      'Draw',
      'Away',
    ]);
  });

  it('matches "Draw" case-insensitively', () => {
    const selections = [sel('draw', 'DRAW'), sel('home', 'Home'), sel('away', 'Away')];
    expect(sortSelectionsWithDrawInMiddle(selections).map((s) => s.name)).toEqual([
      'Home',
      'DRAW',
      'Away',
    ]);
  });

  it('leaves selections unchanged when there is no draw (e.g. a 2-way market)', () => {
    const selections = [sel('home', 'Home'), sel('away', 'Away')];
    expect(sortSelectionsWithDrawInMiddle(selections)).toEqual(selections);
  });

  it('centers Draw among more than two other selections', () => {
    const selections = [sel('a', 'A'), sel('draw', 'Draw'), sel('b', 'B'), sel('c', 'C')];
    expect(sortSelectionsWithDrawInMiddle(selections).map((s) => s.name)).toEqual([
      'A',
      'Draw',
      'B',
      'C',
    ]);
  });
});

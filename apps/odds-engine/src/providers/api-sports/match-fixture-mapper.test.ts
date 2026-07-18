import { describe, expect, it } from 'vitest';
import { findMatchingFixture } from './match-fixture-mapper';
import type { ApiSportsFixtureItem } from './types';

function buildFixture(overrides: Partial<ApiSportsFixtureItem> = {}): ApiSportsFixtureItem {
  return {
    fixture: {
      id: 1,
      date: '2026-07-18T18:30:00Z',
      status: { long: '', short: '1H', elapsed: 12 },
    },
    teams: {
      home: { id: 100, name: 'Bayern Munich' },
      away: { id: 200, name: 'Borussia Dortmund' },
    },
    goals: { home: 1, away: 0 },
    ...overrides,
  };
}

describe('findMatchingFixture', () => {
  it('matches on exact team names', () => {
    const fixtures = [buildFixture()];
    const found = findMatchingFixture(
      { homeTeam: 'Bayern Munich', awayTeam: 'Borussia Dortmund' },
      fixtures,
    );
    expect(found?.fixture.id).toBe(1);
  });

  it('matches case-insensitively and ignoring accents', () => {
    const fixtures = [
      buildFixture({
        teams: {
          home: { id: 100, name: 'Bayern München' },
          away: { id: 200, name: 'Borussia Dortmund' },
        },
      }),
    ];
    const found = findMatchingFixture(
      { homeTeam: 'bayern munchen', awayTeam: 'BORUSSIA DORTMUND' },
      fixtures,
    );
    expect(found?.fixture.id).toBe(1);
  });

  it('matches when one name is a substring of the other (partial team-name spellings)', () => {
    const fixtures = [
      buildFixture({
        teams: { home: { id: 100, name: 'Man City' }, away: { id: 200, name: 'Liverpool' } },
      }),
    ];
    const found = findMatchingFixture(
      { homeTeam: 'Manchester City', awayTeam: 'Liverpool FC' },
      fixtures,
    );
    expect(found?.fixture.id).toBe(1);
  });

  it('returns undefined when no fixture matches both teams', () => {
    const fixtures = [buildFixture()];
    const found = findMatchingFixture({ homeTeam: 'Arsenal', awayTeam: 'Chelsea' }, fixtures);
    expect(found).toBeUndefined();
  });

  it('requires both home and away to match, not just one', () => {
    const fixtures = [buildFixture()];
    const found = findMatchingFixture({ homeTeam: 'Bayern Munich', awayTeam: 'Chelsea' }, fixtures);
    expect(found).toBeUndefined();
  });
});

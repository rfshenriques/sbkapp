import { describe, expect, it } from 'vitest';
import { isLikelyLive, normalizeTheOddsApiEventOdds } from './normalize';
import type { TheOddsApiEventOdds } from './types';

const pendingEventOdds: TheOddsApiEventOdds = {
  id: 'e912304de2b4f88b43d1c294a3e6bfe4',
  sport_key: 'soccer_epl',
  sport_title: 'EPL',
  commence_time: '2026-07-19T19:00:00Z',
  home_team: 'Arsenal',
  away_team: 'Chelsea',
  bookmakers: [
    {
      key: 'pinnacle',
      title: 'Pinnacle',
      last_update: '2026-07-19T18:00:00Z',
      markets: [
        {
          key: 'h2h',
          last_update: '2026-07-19T18:00:00Z',
          outcomes: [
            { name: 'Arsenal', price: 1.9 },
            { name: 'Draw', price: 3.7 },
            { name: 'Chelsea', price: 4.1 },
          ],
        },
      ],
    },
    {
      key: 'paddypower',
      title: 'Paddy Power',
      last_update: '2026-07-19T18:05:00Z',
      markets: [
        {
          key: 'h2h',
          last_update: '2026-07-19T18:05:00Z',
          outcomes: [
            { name: 'Arsenal', price: 1.95 },
            { name: 'Draw', price: 3.6 },
            { name: 'Chelsea', price: 4.0 },
          ],
        },
      ],
    },
  ],
};

describe('isLikelyLive', () => {
  it('is false before kickoff', () => {
    const now = () => new Date('2026-07-19T18:00:00Z').getTime();
    expect(isLikelyLive('2026-07-19T19:00:00Z', now)).toBe(false);
  });

  it('is true shortly after kickoff', () => {
    const now = () => new Date('2026-07-19T19:45:00Z').getTime();
    expect(isLikelyLive('2026-07-19T19:00:00Z', now)).toBe(true);
  });

  it('is false long after kickoff (match has almost certainly finished)', () => {
    const now = () => new Date('2026-07-20T05:00:00Z').getTime();
    expect(isLikelyLive('2026-07-19T19:00:00Z', now)).toBe(false);
  });
});

describe('normalizeTheOddsApiEventOdds', () => {
  it('maps fixture metadata from the raw event fields', () => {
    const now = () => new Date('2026-07-19T10:00:00Z').getTime();
    const match = normalizeTheOddsApiEventOdds(pendingEventOdds, now);

    expect(match).toMatchObject({
      id: 'e912304de2b4f88b43d1c294a3e6bfe4',
      competition: 'EPL',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      kickoff: '2026-07-19T19:00:00Z',
      isLive: false,
    });
  });

  it('prefers Paddy Power over other bookmakers', () => {
    const now = () => new Date('2026-07-19T10:00:00Z').getTime();
    const match = normalizeTheOddsApiEventOdds(pendingEventOdds, now);

    const matchResult = match.markets.find((market) => market.id === 'match-result');
    expect(matchResult).toEqual({
      id: 'match-result',
      name: 'Match Result',
      selections: [
        { id: 'home', name: 'Home', odds: 1.95 },
        { id: 'draw', name: 'Draw', odds: 3.6 },
        { id: 'away', name: 'Away', odds: 4.0 },
      ],
    });
  });

  it('falls back to whichever bookmaker is present when Paddy Power is not offering this fixture', () => {
    const now = () => new Date('2026-07-19T10:00:00Z').getTime();
    const otherBookmaker: TheOddsApiEventOdds = {
      ...pendingEventOdds,
      bookmakers: pendingEventOdds.bookmakers.filter((bookmaker) => bookmaker.key === 'pinnacle'),
    };

    const match = normalizeTheOddsApiEventOdds(otherBookmaker, now);

    const matchResult = match.markets.find((market) => market.id === 'match-result');
    expect(matchResult?.selections).toEqual([
      { id: 'home', name: 'Home', odds: 1.9 },
      { id: 'draw', name: 'Draw', odds: 3.7 },
      { id: 'away', name: 'Away', odds: 4.1 },
    ]);
  });

  it('matches "Paddy Power" regardless of a possible country/region suffix on the title', () => {
    const now = () => new Date('2026-07-19T10:00:00Z').getTime();
    const withSuffix: TheOddsApiEventOdds = {
      ...pendingEventOdds,
      bookmakers: [
        {
          key: 'pinnacle',
          title: 'Pinnacle',
          last_update: '2026-07-19T18:00:00Z',
          markets: [
            {
              key: 'h2h',
              last_update: '2026-07-19T18:00:00Z',
              outcomes: [
                { name: 'Arsenal', price: 2.0 },
                { name: 'Draw', price: 3.5 },
                { name: 'Chelsea', price: 3.9 },
              ],
            },
          ],
        },
        {
          key: 'paddypower_uk',
          title: 'Paddy Power (UK)',
          last_update: '2026-07-19T18:00:00Z',
          markets: [
            {
              key: 'h2h',
              last_update: '2026-07-19T18:00:00Z',
              outcomes: [
                { name: 'Arsenal', price: 2.05 },
                { name: 'Draw', price: 3.4 },
                { name: 'Chelsea', price: 3.8 },
              ],
            },
          ],
        },
      ],
    };

    const match = normalizeTheOddsApiEventOdds(withSuffix, now);
    const matchResult = match.markets.find((market) => market.id === 'match-result');
    expect(matchResult?.selections).toEqual([
      { id: 'home', name: 'Home', odds: 2.05 },
      { id: 'draw', name: 'Draw', odds: 3.4 },
      { id: 'away', name: 'Away', odds: 3.8 },
    ]);
  });

  it('returns an empty markets list when no bookmaker offers h2h', () => {
    const now = () => new Date('2026-07-19T10:00:00Z').getTime();
    const noOdds: TheOddsApiEventOdds = { ...pendingEventOdds, bookmakers: [] };

    const match = normalizeTheOddsApiEventOdds(noOdds, now);
    expect(match.markets).toEqual([]);
  });
});

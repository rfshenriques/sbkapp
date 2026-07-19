import { describe, expect, it } from 'vitest';
import { isLikelyLive, normalizeTheOddsApiEvent, normalizeTheOddsApiEventOdds } from './normalize';
import type { TheOddsApiEvent, TheOddsApiEventOdds } from './types';

const pendingEvent: TheOddsApiEvent = {
  id: 'e912304de2b4f88b43d1c294a3e6bfe4',
  sport_key: 'soccer_epl',
  sport_title: 'EPL',
  commence_time: '2026-07-19T19:00:00Z',
  home_team: 'Arsenal',
  away_team: 'Chelsea',
};

const pendingEventOdds: TheOddsApiEventOdds = {
  ...pendingEvent,
  bookmakers: [
    {
      key: 'betano',
      title: 'Betano',
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
      key: 'betclic',
      title: 'Betclic',
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

describe('normalizeTheOddsApiEvent', () => {
  it('maps fixture metadata with no markets', () => {
    const now = () => new Date('2026-07-19T10:00:00Z').getTime();
    const match = normalizeTheOddsApiEvent(pendingEvent, now);

    expect(match).toEqual({
      id: 'e912304de2b4f88b43d1c294a3e6bfe4',
      competition: 'EPL',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      kickoff: '2026-07-19T19:00:00Z',
      isLive: false,
      markets: [],
    });
  });
});

describe('normalizeTheOddsApiEventOdds', () => {
  it('prefers Betclic over other bookmakers', () => {
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

  it('falls back to Betano when Betclic is not offering this fixture', () => {
    const now = () => new Date('2026-07-19T10:00:00Z').getTime();
    const betanoOnly: TheOddsApiEventOdds = {
      ...pendingEventOdds,
      bookmakers: pendingEventOdds.bookmakers.filter((bookmaker) => bookmaker.key === 'betano'),
    };

    const match = normalizeTheOddsApiEventOdds(betanoOnly, now);

    const matchResult = match.markets.find((market) => market.id === 'match-result');
    expect(matchResult?.selections).toEqual([
      { id: 'home', name: 'Home', odds: 1.9 },
      { id: 'draw', name: 'Draw', odds: 3.7 },
      { id: 'away', name: 'Away', odds: 4.1 },
    ]);
  });

  it('falls back to whichever bookmaker is present when neither preferred one is', () => {
    const now = () => new Date('2026-07-19T10:00:00Z').getTime();
    const otherBookmaker: TheOddsApiEventOdds = {
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
      ],
    };

    const match = normalizeTheOddsApiEventOdds(otherBookmaker, now);
    expect(match.markets.find((market) => market.id === 'match-result')).toBeDefined();
  });

  it('returns an empty markets list when no bookmaker offers h2h', () => {
    const now = () => new Date('2026-07-19T10:00:00Z').getTime();
    const noOdds: TheOddsApiEventOdds = { ...pendingEventOdds, bookmakers: [] };

    const match = normalizeTheOddsApiEventOdds(noOdds, now);
    expect(match.markets).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeOddsApiIoResponse } from './normalize';
import type { OddsApiIoOddsResponse } from './types';

// Captured verbatim from a real GET /v3/odds call against odds-api.io's free tier.
const pendingMatchResponse: OddsApiIoOddsResponse = {
  id: 53452537,
  home: 'Spain',
  away: 'Argentina',
  homeId: 4698,
  awayId: 4819,
  date: '2026-07-19T19:00:00Z',
  status: 'pending',
  sport: { name: 'Football', slug: 'football' },
  league: { name: 'International - FIFA World Cup', slug: 'international-fifa-world-cup' },
  urls: {
    'Betano PT': 'https://www.betano.pt/match-odds/spain-argentina/89136872/',
    'Betclic PT':
      'https://www.betclic.pt/futebol-sfootball/copa-do-mundo-2026-c1/espanha-argentina-m1170404449476608',
  },
  bookmakerIds: { 'Betano PT': '89136872', 'Betclic PT': '1170404449476608' },
  bookmakers: {
    'Betano PT': [
      {
        name: 'ML',
        updatedAt: '2026-07-17T02:00:57.074Z',
        odds: [{ home: '2.40', draw: '2.95', away: '3.45' }],
      },
      {
        name: 'Double Chance',
        updatedAt: '2026-07-17T01:31:13.717Z',
        odds: [{ '1X': '1.30', '12': '1.30', X2: '1.55' }],
      },
      {
        name: 'Totals',
        updatedAt: '2026-07-16T12:06:15.96Z',
        odds: [{ hdp: 2.5, over: '2.02', under: '1.57' }],
      },
      {
        name: 'Both Teams To Score',
        updatedAt: '2026-07-16T21:14:55.463Z',
        odds: [{ yes: '1.72', no: '1.82' }],
      },
    ],
    'Betclic PT': [
      {
        name: 'ML',
        updatedAt: '2026-07-16T04:53:40.805Z',
        odds: [{ home: '2.27', draw: '3.08', away: '3.53' }],
      },
      {
        name: 'Double Chance',
        updatedAt: '2026-07-16T04:53:40.805Z',
        odds: [{ '1X': '1.30', '12': '1.36', X2: '1.55' }],
      },
    ],
  },
};

// Captured from a settled event: finished matches carry no live odds.
const settledMatchResponse: OddsApiIoOddsResponse = {
  id: 68687724,
  home: 'Some Team',
  away: 'Other Team',
  homeId: 1,
  awayId: 2,
  date: '2026-07-01T15:00:00Z',
  status: 'settled',
  sport: { name: 'Football', slug: 'football' },
  league: { name: 'Some League', slug: 'some-league' },
  urls: {},
  bookmakerIds: {},
  bookmakers: {},
};

describe('normalizeOddsApiIoResponse', () => {
  it('maps match metadata from the raw event fields', () => {
    const match = normalizeOddsApiIoResponse(pendingMatchResponse);

    expect(match).toMatchObject({
      id: '53452537',
      competition: 'International - FIFA World Cup',
      homeTeam: 'Spain',
      awayTeam: 'Argentina',
      kickoff: '2026-07-19T19:00:00Z',
      isLive: false,
    });
  });

  it('marks a match live when status is "live"', () => {
    const match = normalizeOddsApiIoResponse({ ...pendingMatchResponse, status: 'live' });
    expect(match.isLive).toBe(true);
  });

  it('defaults to Betclic PT and normalizes ML into a match-result market', () => {
    const match = normalizeOddsApiIoResponse(pendingMatchResponse);

    const matchResult = match.markets.find((market) => market.id === 'match-result');
    expect(matchResult).toEqual({
      id: 'match-result',
      name: 'Match Result',
      selections: [
        { id: 'home', name: 'Home', odds: 2.27 },
        { id: 'draw', name: 'Draw', odds: 3.08 },
        { id: 'away', name: 'Away', odds: 3.53 },
      ],
    });
  });

  it('normalizes Double Chance with readable selection names', () => {
    const match = normalizeOddsApiIoResponse(pendingMatchResponse);

    const doubleChance = match.markets.find((market) => market.id === 'double-chance');
    expect(doubleChance).toEqual({
      id: 'double-chance',
      name: 'Double Chance',
      selections: [
        { id: '12', name: 'Home or Away', odds: 1.36 },
        { id: '1x', name: 'Home or Draw', odds: 1.3 },
        { id: 'x2', name: 'Draw or Away', odds: 1.55 },
      ],
    });
  });

  it('only includes markets offered by the selected bookmaker', () => {
    const match = normalizeOddsApiIoResponse(pendingMatchResponse);

    // Betclic PT (the default) doesn't offer Totals or BTTS in this fixture.
    expect(match.markets.find((market) => market.id.startsWith('totals'))).toBeUndefined();
    expect(match.markets.find((market) => market.id === 'btts')).toBeUndefined();
  });

  it('picks up a line-based market (Totals) from a bookmaker that offers it', () => {
    const match = normalizeOddsApiIoResponse(pendingMatchResponse, 'Betano PT');

    const totals = match.markets.find((market) => market.id === 'totals-2.5');
    expect(totals).toEqual({
      id: 'totals-2.5',
      name: 'Total Goals 2.5',
      selections: [
        { id: 'over', name: 'Over 2.5', odds: 2.02 },
        { id: 'under', name: 'Under 2.5', odds: 1.57 },
      ],
    });
  });

  it('normalizes Both Teams To Score', () => {
    const match = normalizeOddsApiIoResponse(pendingMatchResponse, 'Betano PT');

    const btts = match.markets.find((market) => market.id === 'btts');
    expect(btts).toEqual({
      id: 'btts',
      name: 'Both Teams To Score',
      selections: [
        { id: 'yes', name: 'Yes', odds: 1.72 },
        { id: 'no', name: 'No', odds: 1.82 },
      ],
    });
  });

  it('returns an empty markets list for a settled event with no bookmaker data', () => {
    const match = normalizeOddsApiIoResponse(settledMatchResponse);
    expect(match.markets).toEqual([]);
    expect(match.isLive).toBe(false);
  });
});

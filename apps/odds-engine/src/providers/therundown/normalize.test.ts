import { describe, expect, it } from 'vitest';
import { americanToDecimal, normalizeTheRundownEvent } from './normalize';
import type { TheRundownEvent } from './types';

function soccerEvent(overrides: Partial<TheRundownEvent> = {}): TheRundownEvent {
  return {
    event_id: 'abc123',
    sport_id: 11, // EPL
    event_date: '2026-08-28T19:00:00Z',
    teams: [
      { team_id: 1, name: 'Crystal Palace', mascot: '', abbreviation: 'CRY', is_home: true, is_away: false },
      { team_id: 2, name: 'Manchester City', mascot: '', abbreviation: 'MNC', is_home: false, is_away: true },
    ],
    markets: [
      {
        market_id: 1,
        name: 'moneyline',
        participants: [
          {
            id: 1,
            type: 'TYPE_TEAM',
            name: 'Crystal Palace',
            lines: [
              {
                value: '',
                prices: {
                  // affiliate 19: home +425, draw +320, away -165 -> overround ~1.051, the tighter of the two, should win
                  '19': { price: 425, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' },
                  // affiliate 23: home +333, draw +280, away -160 -> overround ~1.109
                  '23': { price: 333, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' },
                },
              },
            ],
          },
          {
            id: 3,
            type: 'TYPE_RESULT',
            name: 'Draw',
            lines: [
              {
                value: '',
                prices: {
                  '19': { price: 320, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' },
                  '23': { price: 280, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' },
                },
              },
            ],
          },
          {
            id: 2,
            type: 'TYPE_TEAM',
            name: 'Manchester City',
            lines: [
              {
                value: '',
                prices: {
                  '19': { price: -165, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' },
                  '23': { price: -160, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' },
                },
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('americanToDecimal', () => {
  it('converts positive American odds', () => {
    expect(americanToDecimal(150)).toBeCloseTo(2.5);
  });

  it('converts negative American odds', () => {
    expect(americanToDecimal(-170)).toBeCloseTo(1.588, 3);
  });
});

describe('normalizeTheRundownEvent', () => {
  it('maps sport_id to our own sport/country/competition labels', () => {
    const match = normalizeTheRundownEvent(soccerEvent());
    expect(match?.sport).toBe('Football');
    expect(match?.country).toBe('England');
    expect(match?.competition).toBe('Premier League');
  });

  it('prefixes the id so it never collides with a the-odds-api id', () => {
    const match = normalizeTheRundownEvent(soccerEvent());
    expect(match?.id).toBe('therundown:abc123');
  });

  it('prices the whole market from the single affiliate with the lowest overround, not the best price per selection', () => {
    const match = normalizeTheRundownEvent(soccerEvent());
    const selections = match?.markets[0]?.selections;

    // Affiliate 19 (425/320/-165, overround ~1.051) beats affiliate 23
    // (333/280/-160, overround ~1.109) and should win outright, even
    // though 23 alone has the better away price - never a mix of the two.
    const home = selections?.find((selection) => selection.id === 'home');
    const draw = selections?.find((selection) => selection.id === 'draw');
    const away = selections?.find((selection) => selection.id === 'away');
    expect(home?.odds).toBeCloseTo(americanToDecimal(425));
    expect(draw?.odds).toBeCloseTo(americanToDecimal(320));
    expect(away?.odds).toBeCloseTo(americanToDecimal(-165));
  });

  it('ignores an affiliate that only prices some of the market', () => {
    const event = soccerEvent();
    // Affiliate 99 only has a home price - never a legitimate winner even
    // though a single-selection "overround" would look artificially low.
    event.markets![0]!.participants[0]!.lines[0]!.prices['99'] = {
      price: 100000,
      is_main_line: true,
      updated_at: '2026-08-28T00:00:00Z',
    };

    const match = normalizeTheRundownEvent(event);
    const home = match?.markets[0]?.selections.find((selection) => selection.id === 'home');
    expect(home?.odds).toBeLessThan(100);
  });

  it('excludes the 0.0001 off-the-board sentinel from consideration, omitting the market entirely when nothing is left', () => {
    const event = soccerEvent();
    for (const participant of event.markets![0]!.participants) {
      for (const line of participant.lines) {
        for (const key of Object.keys(line.prices)) {
          line.prices[key] = { price: 0.0001, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' };
        }
      }
    }

    const match = normalizeTheRundownEvent(event);
    expect(match?.markets).toEqual([]);
  });

  it('derives isLive from the real event_status field, not a kickoff-time guess', () => {
    const live = normalizeTheRundownEvent(soccerEvent({ score: { event_status: 'STATUS_IN_PROGRESS' } }));
    const scheduled = normalizeTheRundownEvent(soccerEvent({ score: { event_status: 'STATUS_SCHEDULED' } }));
    const final = normalizeTheRundownEvent(soccerEvent({ score: { event_status: 'STATUS_FINAL' } }));

    expect(live?.isLive).toBe(true);
    expect(scheduled?.isLive).toBe(false);
    expect(final?.isLive).toBe(false);
  });

  it('returns undefined for a sport_id outside RELEVANT_SPORT_IDS', () => {
    expect(normalizeTheRundownEvent(soccerEvent({ sport_id: 999 }))).toBeUndefined();
  });

  it('returns undefined when the event has no home or away team', () => {
    expect(normalizeTheRundownEvent(soccerEvent({ teams: [] }))).toBeUndefined();
  });

  it('returns an empty markets array when there is no moneyline market', () => {
    const match = normalizeTheRundownEvent(soccerEvent({ markets: [] }));
    expect(match?.markets).toEqual([]);
  });

  it('maps the handicap market with real team names and a formatted spread value, ignoring non-main alt lines', () => {
    const event = soccerEvent({
      markets: [
        {
          market_id: 2,
          name: 'handicap',
          participants: [
            {
              id: 1,
              type: 'TYPE_TEAM',
              name: 'Crystal Palace',
              lines: [
                { value: '+1.5', prices: { '19': { price: -110, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } },
                // Alt line, not the main one - must never win even though its price alone looks great.
                { value: '+4.5', prices: { '19': { price: -900, is_main_line: false, updated_at: '2026-08-28T00:00:00Z' } } },
              ],
            },
            {
              id: 2,
              type: 'TYPE_TEAM',
              name: 'Manchester City',
              lines: [{ value: '-1.5', prices: { '19': { price: -110, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
            },
          ],
        },
      ],
    });

    const match = normalizeTheRundownEvent(event);
    const handicap = match?.markets.find((market) => market.id === 'handicap');

    expect(handicap?.name).toBe('Handicap');
    expect(handicap?.selections).toEqual([
      { id: 'home', name: 'Crystal Palace +1.5', odds: americanToDecimal(-110) },
      { id: 'away', name: 'Manchester City -1.5', odds: americanToDecimal(-110) },
    ]);
  });

  it('prepends "+" to a positive spread value that does not already carry a sign', () => {
    const event = soccerEvent({
      markets: [
        {
          market_id: 2,
          name: 'handicap',
          participants: [
            {
              id: 1,
              type: 'TYPE_TEAM',
              name: 'Crystal Palace',
              // No leading sign, unlike the fixture above - a plan/sport that sends bare numbers.
              lines: [{ value: '1.5', prices: { '19': { price: -110, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
            },
            {
              id: 2,
              type: 'TYPE_TEAM',
              name: 'Manchester City',
              lines: [{ value: '-1.5', prices: { '19': { price: -110, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
            },
          ],
        },
      ],
    });

    const match = normalizeTheRundownEvent(event);
    const home = match?.markets.find((market) => market.id === 'handicap')?.selections.find((s) => s.id === 'home');
    expect(home?.name).toBe('Crystal Palace +1.5');
  });

  it('maps the totals market as Over/Under with the total value in the selection name', () => {
    const event = soccerEvent({
      markets: [
        {
          market_id: 3,
          name: 'totals',
          participants: [
            {
              id: 1001,
              type: 'TYPE_RESULT',
              name: 'Over',
              lines: [{ value: '2.5', prices: { '19': { price: -105, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
            },
            {
              id: 1002,
              type: 'TYPE_RESULT',
              name: 'Under',
              lines: [{ value: '2.5', prices: { '19': { price: -115, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
            },
          ],
        },
      ],
    });

    const match = normalizeTheRundownEvent(event);
    const totals = match?.markets.find((market) => market.id === 'total-goals');

    expect(totals?.name).toBe('Total Goals');
    expect(totals?.selections).toEqual([
      { id: 'over', name: 'Over 2.5', odds: americanToDecimal(-105) },
      { id: 'under', name: 'Under 2.5', odds: americanToDecimal(-115) },
    ]);
  });

  it('names the totals market "Totals" (not "Total Goals") for a non-football sport', () => {
    const event = soccerEvent({
      sport_id: 6, // NHL
      markets: [
        {
          market_id: 3,
          name: 'totals',
          participants: [
            {
              id: 1001,
              type: 'TYPE_RESULT',
              name: 'Over',
              lines: [{ value: '5.5', prices: { '19': { price: -110, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
            },
            {
              id: 1002,
              type: 'TYPE_RESULT',
              name: 'Under',
              lines: [{ value: '5.5', prices: { '19': { price: -110, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
            },
          ],
        },
      ],
    });

    const match = normalizeTheRundownEvent(event);
    expect(match?.markets.find((market) => market.id === 'total-goals')?.name).toBe('Totals');
  });

  it('omits the handicap/totals market entirely when no affiliate prices both sides', () => {
    const event = soccerEvent({
      markets: [
        {
          market_id: 2,
          name: 'handicap',
          participants: [
            {
              id: 1,
              type: 'TYPE_TEAM',
              name: 'Crystal Palace',
              lines: [{ value: '+1.5', prices: { '19': { price: -110, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
            },
            {
              id: 2,
              type: 'TYPE_TEAM',
              name: 'Manchester City',
              // Only affiliate 23 prices the away side - no single affiliate covers the whole market.
              lines: [{ value: '-1.5', prices: { '23': { price: -110, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
            },
          ],
        },
      ],
    });

    const match = normalizeTheRundownEvent(event);
    expect(match?.markets.find((market) => market.id === 'handicap')).toBeUndefined();
  });
});

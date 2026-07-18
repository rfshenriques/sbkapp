import { describe, expect, it } from 'vitest';
import { normalizeEvents, normalizeStats } from './normalize';
import type { ApiSportsEvent, ApiSportsTeamStatistics } from './types';

describe('normalizeEvents', () => {
  it('maps event type, team side, player, and assist', () => {
    const raw: ApiSportsEvent[] = [
      {
        time: { elapsed: 23, extra: null },
        team: { id: 100, name: 'Bayern Munich' },
        player: { id: 1, name: 'Harry Kane' },
        assist: { id: 2, name: 'Jamal Musiala' },
        type: 'Goal',
        detail: 'Normal Goal',
      },
      {
        time: { elapsed: 64, extra: null },
        team: { id: 200, name: 'Borussia Dortmund' },
        player: { id: 3, name: 'Nico Schlotterbeck' },
        assist: { id: null, name: null },
        type: 'Card',
        detail: 'Yellow Card',
      },
    ];

    const events = normalizeEvents(raw, 100);

    // Sorted most recent first.
    expect(events).toEqual([
      {
        minute: 64,
        extraMinute: undefined,
        type: 'card',
        team: 'away',
        player: 'Nico Schlotterbeck',
        detail: 'Yellow Card',
        assistPlayer: undefined,
      },
      {
        minute: 23,
        extraMinute: undefined,
        type: 'goal',
        team: 'home',
        player: 'Harry Kane',
        detail: 'Normal Goal',
        assistPlayer: 'Jamal Musiala',
      },
    ]);
  });

  it('maps substitution and unknown types', () => {
    const raw: ApiSportsEvent[] = [
      {
        time: { elapsed: 70, extra: null },
        team: { id: 100, name: 'Bayern Munich' },
        player: { id: 1, name: 'Player In' },
        assist: { id: 2, name: 'Player Out' },
        type: 'subst',
        detail: 'Substitution 1',
      },
    ];

    expect(normalizeEvents(raw, 100)[0]?.type).toBe('substitution');
  });

  it('falls back to "Unknown player" when the provider gives no player name', () => {
    const raw: ApiSportsEvent[] = [
      {
        time: { elapsed: 10, extra: null },
        team: { id: 100, name: 'Bayern Munich' },
        player: { id: null, name: null },
        assist: { id: null, name: null },
        type: 'Goal',
        detail: 'Own Goal',
      },
    ];

    expect(normalizeEvents(raw, 100)[0]?.player).toBe('Unknown player');
  });
});

describe('normalizeStats', () => {
  it('pairs each stat type by home/away team id regardless of array order', () => {
    const raw: ApiSportsTeamStatistics[] = [
      {
        team: { id: 200, name: 'Borussia Dortmund' },
        statistics: [
          { type: 'Corner Kicks', value: 2 },
          { type: 'Ball Possession', value: '39%' },
        ],
      },
      {
        team: { id: 100, name: 'Bayern Munich' },
        statistics: [
          { type: 'Corner Kicks', value: 7 },
          { type: 'Ball Possession', value: '61%' },
        ],
      },
    ];

    expect(normalizeStats(raw, 100)).toEqual([
      { type: 'Corner Kicks', home: 7, away: 2 },
      { type: 'Ball Possession', home: '61%', away: '39%' },
    ]);
  });

  it('treats a null stat value as 0', () => {
    const raw: ApiSportsTeamStatistics[] = [
      { team: { id: 100, name: 'A' }, statistics: [{ type: 'Red Cards', value: null }] },
      { team: { id: 200, name: 'B' }, statistics: [{ type: 'Red Cards', value: 1 }] },
    ];

    expect(normalizeStats(raw, 100)).toEqual([{ type: 'Red Cards', home: 0, away: 1 }]);
  });

  it('returns an empty array when statistics for one side are missing', () => {
    const raw: ApiSportsTeamStatistics[] = [
      { team: { id: 100, name: 'A' }, statistics: [{ type: 'Red Cards', value: 0 }] },
    ];

    expect(normalizeStats(raw, 100)).toEqual([]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createTheRundownClient } from './client';

function jsonResponse(body: unknown, init: Partial<{ ok: boolean; status: number; statusText: string }> = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('createTheRundownClient', () => {
  it('getSports sends the key header and unwraps the sports array', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ sports: [{ sport_id: 11, sport_name: 'EPL' }] }));
    const client = createTheRundownClient({ apiKey: 'test-key', fetchImpl });

    const sports = await client.getSports();

    expect(sports).toEqual([{ sport_id: 11, sport_name: 'EPL' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('https://therundown.io/api/v2/sports');
    expect((init as RequestInit).headers).toEqual({ 'X-Therundown-Key': 'test-key' });
  });

  it('getEventsBySportAndDate builds the sport/date path and unwraps events', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ meta: null, events: [{ event_id: 'abc', sport_id: 11, event_date: '2026-08-29T00:00:00Z', teams: [] }] }),
    );
    const client = createTheRundownClient({ apiKey: 'test-key', fetchImpl });

    const events = await client.getEventsBySportAndDate({ sportId: 11, date: '2026-08-29' });

    expect(events).toEqual([{ event_id: 'abc', sport_id: 11, event_date: '2026-08-29T00:00:00Z', teams: [] }]);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe('https://therundown.io/api/v2/sports/11/events/2026-08-29');
  });

  it('getEventsBySportAndDate passes market_ids and offset through as query params', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ meta: null, events: [] }));
    const client = createTheRundownClient({ apiKey: 'test-key', fetchImpl });

    await client.getEventsBySportAndDate({ sportId: 4, date: '2026-08-29', marketIds: '1,2,3', offsetMinutes: 300 });

    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.searchParams.get('market_ids')).toBe('1,2,3');
    expect(url.searchParams.get('offset')).toBe('300');
  });

  it('getEventById returns the first event, or undefined when the response has none', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ meta: null, events: [{ event_id: 'abc', sport_id: 11, event_date: '2026-08-29T00:00:00Z', teams: [] }] }))
      .mockResolvedValueOnce(jsonResponse({ meta: null, events: [] }));
    const client = createTheRundownClient({ apiKey: 'test-key', fetchImpl });

    const found = await client.getEventById('abc');
    expect(found?.event_id).toBe('abc');

    const missing = await client.getEventById('nope');
    expect(missing).toBeUndefined();
  });

  it('getTeamStats builds the event stats path and passes stat_ids through', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([{ team: { team_id: 11, name: 'Atlanta', mascot: 'Hawks', abbreviation: 'ATL' }, meta: { complete: true }, stats: [] }]),
    );
    const client = createTheRundownClient({ apiKey: 'test-key', fetchImpl });

    const stats = await client.getTeamStats('e1', ['1242', '1243']);

    expect(stats[0]?.team.name).toBe('Atlanta');
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.pathname).toBe('/api/v2/events/e1/stats');
    expect(url.searchParams.get('stats_ids')).toBe('1242,1243');
  });

  it('getTeamStats omits stats_ids when none are passed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = createTheRundownClient({ apiKey: 'test-key', fetchImpl });

    await client.getTeamStats('e1');

    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.searchParams.has('stats_ids')).toBe(false);
  });

  it('getPlayerStats builds the player stats path and passes stat_ids/player_ids through', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          player: { id: 16627, sport_id: 4, team_id: 11, first_name: 'Trae', last_name: 'Young', display_name: 'Trae Young' },
          meta: { complete: true },
          stats: [],
        },
      ]),
    );
    const client = createTheRundownClient({ apiKey: 'test-key', fetchImpl });

    const stats = await client.getPlayerStats('e1', ['1288', '1289'], ['16627']);

    expect(stats[0]?.player.display_name).toBe('Trae Young');
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.pathname).toBe('/api/v2/events/e1/players/stats');
    expect(url.searchParams.get('stats_ids')).toBe('1288,1289');
    expect(url.searchParams.get('player_ids')).toBe('16627');
  });

  it('throws a descriptive error on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'bad key' }, { ok: false, status: 401, statusText: 'Unauthorized' }));
    const client = createTheRundownClient({ apiKey: 'bad-key', fetchImpl });

    await expect(client.getSports()).rejects.toThrow(/therundown GET \/api\/v2\/sports failed: 401 Unauthorized/);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveScoreboardService } from './live-scoreboard-service';
import type { ApiSportsClient } from './client';
import type { ApiSportsFixtureItem } from './types';

function buildFixture(overrides: Partial<ApiSportsFixtureItem> = {}): ApiSportsFixtureItem {
  return {
    fixture: {
      id: 55,
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

function buildClient(overrides: Partial<ApiSportsClient> = {}): ApiSportsClient {
  return {
    getLiveFixtures: vi.fn().mockResolvedValue([buildFixture()]),
    getFixtureById: vi.fn(),
    getFixtureEvents: vi.fn(),
    getFixtureStatistics: vi.fn(),
    ...overrides,
  };
}

const MATCH = { id: 'match-1', homeTeam: 'Bayern Munich', awayTeam: 'Borussia Dortmund' };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createLiveScoreboardService', () => {
  it('has an empty scoreboard before start()', () => {
    const service = createLiveScoreboardService({
      client: buildClient(),
      listLiveMatches: vi.fn().mockResolvedValue([]),
    });
    expect(service.getScoreboard()).toEqual({});
  });

  it('builds a score+clock entry for every live match from a single getLiveFixtures call', async () => {
    const client = buildClient();
    const otherFixture = buildFixture({
      fixture: { id: 77, date: '', status: { long: '', short: '2H', elapsed: 60 } },
      teams: { home: { id: 300, name: 'Real Madrid' }, away: { id: 400, name: 'Barcelona' } },
      goals: { home: 2, away: 1 },
    });
    client.getLiveFixtures = vi.fn().mockResolvedValue([buildFixture(), otherFixture]);
    const listLiveMatches = vi.fn().mockResolvedValue([
      MATCH,
      { id: 'match-2', homeTeam: 'Real Madrid', awayTeam: 'Barcelona' },
    ]);
    const service = createLiveScoreboardService({ client, listLiveMatches, now: () => 0 });

    await service.start();

    expect(client.getFixtureById).not.toHaveBeenCalled();
    expect(service.getScoreboard()).toEqual({
      'match-1': {
        matchId: 'match-1',
        minute: 12,
        period: '1H',
        homeScore: 1,
        awayScore: 0,
        updatedAt: new Date(0).toISOString(),
      },
      'match-2': {
        matchId: 'match-2',
        minute: 60,
        period: '2H',
        homeScore: 2,
        awayScore: 1,
        updatedAt: new Date(0).toISOString(),
      },
    });
    service.stop();
  });

  it('skips the api-sports request entirely when nothing is live', async () => {
    const client = buildClient();
    const listLiveMatches = vi.fn().mockResolvedValue([]);
    const service = createLiveScoreboardService({ client, listLiveMatches });

    await service.start();

    expect(client.getLiveFixtures).not.toHaveBeenCalled();
    expect(service.getScoreboard()).toEqual({});
    service.stop();
  });

  it('drops a live match from the scoreboard once no fixture matches it any more', async () => {
    const client = buildClient();
    const listLiveMatches = vi.fn().mockResolvedValue([MATCH]);
    const service = createLiveScoreboardService({ client, listLiveMatches, pollIntervalMs: 1000, now: () => 0 });

    await service.start();

    client.getLiveFixtures = vi.fn().mockResolvedValue([]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(service.getScoreboard()).toEqual({});
    service.stop();
  });

  it('polls again after the interval and refreshes the snapshot', async () => {
    const client = buildClient();
    const listLiveMatches = vi.fn().mockResolvedValue([MATCH]);
    const service = createLiveScoreboardService({ client, listLiveMatches, pollIntervalMs: 1000, now: () => 0 });

    await service.start();

    client.getLiveFixtures = vi.fn().mockResolvedValue([buildFixture({ goals: { home: 2, away: 0 } })]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(service.getScoreboard()['match-1']?.homeScore).toBe(2);
    service.stop();
  });

  it('keeps the previous snapshot when a poll fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = buildClient();
    const listLiveMatches = vi.fn().mockResolvedValue([MATCH]);
    const service = createLiveScoreboardService({ client, listLiveMatches, pollIntervalMs: 1000, now: () => 0 });

    await service.start();

    client.getLiveFixtures = vi.fn().mockRejectedValue(new Error('api-sports down'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(service.getScoreboard()['match-1']).toBeDefined();
    service.stop();
    errorSpy.mockRestore();
  });

  it('stop() cancels further polling', async () => {
    const client = buildClient();
    const listLiveMatches = vi.fn().mockResolvedValue([MATCH]);
    const service = createLiveScoreboardService({ client, listLiveMatches, pollIntervalMs: 1000 });

    await service.start();

    service.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(client.getLiveFixtures).toHaveBeenCalledTimes(1);
  });

  it('start() is a no-op when already running', async () => {
    const client = buildClient();
    const listLiveMatches = vi.fn().mockResolvedValue([MATCH]);
    const service = createLiveScoreboardService({ client, listLiveMatches, pollIntervalMs: 1000 });

    await service.start();
    await service.start();
    expect(listLiveMatches).toHaveBeenCalledTimes(1);
    service.stop();
  });
});

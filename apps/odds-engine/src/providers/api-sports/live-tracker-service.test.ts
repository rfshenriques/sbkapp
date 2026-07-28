import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveTrackerService } from './live-tracker-service';
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
  const fixture = buildFixture();
  return {
    getLiveFixtures: vi.fn().mockResolvedValue([fixture]),
    getFixtureById: vi.fn().mockResolvedValue(fixture),
    getFixtureEvents: vi.fn().mockResolvedValue([]),
    getFixtureStatistics: vi.fn().mockResolvedValue([
      { team: { id: 100, name: 'Bayern Munich' }, statistics: [{ type: 'Total Shots', value: 3 }] },
      {
        team: { id: 200, name: 'Borussia Dortmund' },
        statistics: [{ type: 'Total Shots', value: 1 }],
      },
    ]),
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

describe('createLiveTrackerService', () => {
  it('has no state before track() is called', () => {
    const service = createLiveTrackerService({ client: buildClient() });
    expect(service.getState('match-1')).toBeUndefined();
  });

  it('resolves the fixture and returns a normalized snapshot after the first poll', async () => {
    const client = buildClient();
    const service = createLiveTrackerService({ client, now: () => 0 });

    await service.track(MATCH);

    expect(client.getLiveFixtures).toHaveBeenCalledTimes(1);
    expect(client.getFixtureById).toHaveBeenCalledWith(55);
    expect(client.getFixtureEvents).toHaveBeenCalledWith(55);
    expect(client.getFixtureStatistics).toHaveBeenCalledWith(55);

    const state = service.getState('match-1');
    expect(state).toEqual({
      matchId: 'match-1',
      minute: 12,
      period: '1H',
      homeScore: 1,
      awayScore: 0,
      events: [],
      stats: [{ type: 'Total Shots', home: 3, away: 1 }],
      momentum: { home: 50, away: 50 },
      updatedAt: new Date(0).toISOString(),
    });
  });

  it('leaves state undefined when no live fixture matches the given teams', async () => {
    const client = buildClient({ getLiveFixtures: vi.fn().mockResolvedValue([]) });
    const service = createLiveTrackerService({ client });

    await service.track(MATCH);

    expect(service.getState('match-1')).toBeUndefined();
    expect(client.getFixtureById).not.toHaveBeenCalled();
  });

  it('polls again after the interval and updates the snapshot', async () => {
    const client = buildClient();
    const service = createLiveTrackerService({ client, pollIntervalMs: 1000 });

    await service.track(MATCH);
    expect(client.getFixtureById).toHaveBeenCalledTimes(1);

    client.getFixtureById = vi.fn().mockResolvedValue(
      buildFixture({
        goals: { home: 2, away: 0 },
        fixture: { id: 55, date: '', status: { long: '', short: 'HT', elapsed: 15 } },
      }),
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(service.getState('match-1')?.homeScore).toBe(2);
    expect(service.getState('match-1')?.minute).toBe(15);
    expect(service.getState('match-1')?.period).toBe('HT');
  });

  it('calls onUpdate after every successful poll', async () => {
    const onUpdate = vi.fn();
    const client = buildClient();
    const service = createLiveTrackerService({ client, onUpdate, pollIntervalMs: 1000 });

    await service.track(MATCH);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('stops polling but keeps the final snapshot once the fixture is finished', async () => {
    const client = buildClient();
    const service = createLiveTrackerService({ client, pollIntervalMs: 1000 });
    await service.track(MATCH);

    client.getFixtureById = vi.fn().mockResolvedValue(
      buildFixture({
        fixture: { id: 55, date: '', status: { long: '', short: 'FT', elapsed: 90 } },
      }),
    );
    await vi.advanceTimersByTimeAsync(1000);

    expect(service.getState('match-1')?.minute).toBe(90);

    // No further polling after full time - advancing well past another interval shouldn't call again.
    const callsAtFullTime = (client.getFixtureById as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.getFixtureById).toHaveBeenCalledTimes(callsAtFullTime);
  });

  it('re-targets to a new match, dropping state for the previous one', async () => {
    const client = buildClient();
    const service = createLiveTrackerService({ client, pollIntervalMs: 1000 });
    await service.track(MATCH);
    expect(service.getState('match-1')).toBeDefined();

    const otherFixture = buildFixture({
      fixture: { id: 77, date: '', status: { long: '', short: '2H', elapsed: 60 } },
      teams: { home: { id: 300, name: 'Real Madrid' }, away: { id: 400, name: 'Barcelona' } },
      goals: { home: 2, away: 1 },
    });
    client.getLiveFixtures = vi.fn().mockResolvedValue([otherFixture]);
    client.getFixtureById = vi.fn().mockResolvedValue(otherFixture);

    await service.track({ id: 'match-2', homeTeam: 'Real Madrid', awayTeam: 'Barcelona' });

    expect(service.getState('match-1')).toBeUndefined();
    expect(service.getState('match-2')?.homeScore).toBe(2);
  });

  it('is a no-op when track() is called again for the same match already being tracked', async () => {
    const client = buildClient();
    const service = createLiveTrackerService({ client });
    await service.track(MATCH);
    await service.track(MATCH);

    expect(client.getLiveFixtures).toHaveBeenCalledTimes(1);
  });

  it('stop() clears state and cancels further polling', async () => {
    const client = buildClient();
    const service = createLiveTrackerService({ client, pollIntervalMs: 1000 });
    await service.track(MATCH);

    service.stop();
    expect(service.getState('match-1')).toBeUndefined();

    await vi.advanceTimersByTimeAsync(5000);
    expect(client.getFixtureById).toHaveBeenCalledTimes(1);
  });
});

import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { Match } from '@sportsbook/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OddsEngineClient } from './odds-engine-client';

const match: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'EPL',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [],
};

describe('OddsEngineClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchMatches returns the parsed match list on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([match]), { status: 200 })),
    );

    const client = new OddsEngineClient();
    expect(await client.fetchMatches()).toEqual([match]);
  });

  it('fetchMatches throws when odds-engine responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const client = new OddsEngineClient();
    await expect(client.fetchMatches()).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('fetchMatchById returns the match on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(match), { status: 200 })));

    const client = new OddsEngineClient();
    expect(await client.fetchMatchById('match-1')).toEqual(match);
  });

  it('fetchMatchById throws NotFoundException on a 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const client = new OddsEngineClient();
    await expect(client.fetchMatchById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

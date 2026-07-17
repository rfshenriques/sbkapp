import { vi } from 'vitest';
import { mockMatches } from '../mocks/matches';
import type { Match } from '@sportsbook/shared';

const BASE_URL = '/api';

/** Stubs global fetch to behave like the odds-engine's GET /events and /events/:id. */
export function stubOddsEngineFetch(matches: Match[] = mockMatches) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url === `${BASE_URL}/events`) {
      return new Response(JSON.stringify(matches), { status: 200 });
    }

    const eventIdMatch = /\/events\/([^/]+)$/.exec(url);
    if (eventIdMatch) {
      const found = matches.find((match) => match.id === eventIdMatch[1]);
      return found
        ? new Response(JSON.stringify(found), { status: 200 })
        : new Response(null, { status: 404 });
    }

    return new Response(null, { status: 404 });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

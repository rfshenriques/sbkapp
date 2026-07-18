import type {
  ApiSportsEvent,
  ApiSportsFixtureItem,
  ApiSportsResponse,
  ApiSportsTeamStatistics,
} from './types';

const BASE_URL = 'https://v3.football.api-sports.io';

export interface ApiSportsClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface ApiSportsClient {
  /** All fixtures currently in-play, worldwide - one request regardless of how many are live. */
  getLiveFixtures(): Promise<ApiSportsFixtureItem[]>;
  getFixtureById(fixtureId: number): Promise<ApiSportsFixtureItem | undefined>;
  getFixtureEvents(fixtureId: number): Promise<ApiSportsEvent[]>;
  getFixtureStatistics(fixtureId: number): Promise<ApiSportsTeamStatistics[]>;
}

export function createApiSportsClient(options: ApiSportsClientOptions): ApiSportsClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetchImpl(url.toString(), {
      headers: { 'x-apisports-key': options.apiKey },
    });
    if (!response.ok) {
      throw new Error(`api-sports GET ${path} failed: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as ApiSportsResponse<T>;
    return body.response;
  }

  return {
    getLiveFixtures: () => request<ApiSportsFixtureItem>('/fixtures', { live: 'all' }),
    getFixtureById: async (fixtureId) => {
      const [fixture] = await request<ApiSportsFixtureItem>('/fixtures', { id: String(fixtureId) });
      return fixture;
    },
    getFixtureEvents: (fixtureId) =>
      request<ApiSportsEvent>('/fixtures/events', { fixture: String(fixtureId) }),
    getFixtureStatistics: (fixtureId) =>
      request<ApiSportsTeamStatistics>('/fixtures/statistics', { fixture: String(fixtureId) }),
  };
}

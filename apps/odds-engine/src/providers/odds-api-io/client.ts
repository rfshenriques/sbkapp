import type { OddsApiIoEvent, OddsApiIoOddsResponse } from './types';

const BASE_URL = 'https://api.odds-api.io/v3';

export interface OddsApiIoClientOptions {
  apiKey: string;
  /** Bookmakers to request odds for. Our free-tier key currently only grants "Betclic PT" and "Betano PT". */
  bookmakers?: string[];
  fetchImpl?: typeof fetch;
}

export interface GetEventsParams {
  sport: string;
  limit?: number;
}

export interface OddsApiIoClient {
  getEvents(params: GetEventsParams): Promise<OddsApiIoEvent[]>;
  getOdds(eventId: number): Promise<OddsApiIoOddsResponse>;
}

export function createOddsApiIoClient(options: OddsApiIoClientOptions): OddsApiIoClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const bookmakers = options.bookmakers ?? ['Betclic PT', 'Betano PT'];

  async function getEvents({ sport, limit }: GetEventsParams): Promise<OddsApiIoEvent[]> {
    const url = new URL(`${BASE_URL}/events`);
    url.searchParams.set('apiKey', options.apiKey);
    url.searchParams.set('sport', sport);
    if (limit !== undefined) {
      url.searchParams.set('limit', String(limit));
    }

    const response = await fetchImpl(url.toString());
    if (!response.ok) {
      throw new Error(`odds-api.io GET /events failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as OddsApiIoEvent[];
  }

  async function getOdds(eventId: number): Promise<OddsApiIoOddsResponse> {
    const url = new URL(`${BASE_URL}/odds`);
    url.searchParams.set('apiKey', options.apiKey);
    url.searchParams.set('eventId', String(eventId));
    url.searchParams.set('bookmakers', bookmakers.join(','));

    const response = await fetchImpl(url.toString());
    if (!response.ok) {
      throw new Error(`odds-api.io GET /odds failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as OddsApiIoOddsResponse;
  }

  return { getEvents, getOdds };
}

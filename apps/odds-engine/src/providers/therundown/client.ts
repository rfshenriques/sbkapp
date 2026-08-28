import type { TheRundownEvent, TheRundownEventsResponse, TheRundownSport, TheRundownSportsResponse } from './types';

const BASE_URL = 'https://therundown.io';

export interface TheRundownClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface GetEventsBySportAndDateParams {
  sportId: number;
  /** YYYY-MM-DD. */
  date: string;
  /**
   * Comma-separated market IDs, e.g. "1,2,3" (Moneyline, Spread, Total -
   * the API's own default). Max 12 per request - IDs beyond the 12th are
   * silently ignored by the provider, not rejected.
   */
  marketIds?: string;
  /** UTC offset in minutes for the date boundary (e.g. 300 for US Central) - see the API's OffsetQuery. Without this the day boundary is midnight UTC. */
  offsetMinutes?: number;
}

export interface TheRundownClient {
  /** No auth required by the provider, but the key is sent anyway - harmless, and keeps every call consistent. */
  getSports(): Promise<TheRundownSport[]>;
  /** The primary "build an odds screen" endpoint - one sport, one day, full market/odds data per event. */
  getEventsBySportAndDate(params: GetEventsBySportAndDateParams): Promise<TheRundownEvent[]>;
  getEventById(eventId: string): Promise<TheRundownEvent | undefined>;
}

export function createTheRundownClient(options: TheRundownClientOptions): TheRundownClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetchImpl(url.toString(), {
      headers: { 'X-Therundown-Key': options.apiKey },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`therundown GET ${path} failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
    }
    return (await response.json()) as T;
  }

  return {
    getSports: async () => {
      const body = await request<TheRundownSportsResponse>('/api/v2/sports');
      return body.sports;
    },
    getEventsBySportAndDate: async ({ sportId, date, marketIds, offsetMinutes }) => {
      const params: Record<string, string> = {};
      if (marketIds) params.market_ids = marketIds;
      if (offsetMinutes !== undefined) params.offset = String(offsetMinutes);
      const body = await request<TheRundownEventsResponse>(`/api/v2/sports/${sportId}/events/${date}`, params);
      return body.events;
    },
    getEventById: async (eventId) => {
      const body = await request<TheRundownEventsResponse>(`/api/v2/events/${eventId}`);
      return body.events[0];
    },
  };
}

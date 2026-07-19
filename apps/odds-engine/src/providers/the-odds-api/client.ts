import type { TheOddsApiEvent, TheOddsApiEventOdds, TheOddsApiSport } from './types';

const BASE_URL = 'https://api.the-odds-api.com/v4';

export interface TheOddsApiClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface GetEventOddsParams {
  sportKey: string;
  eventId: string;
  /** Comma-separated region codes (us/uk/eu/au). Betclic/Betano are both EU-region bookmakers. */
  regions?: string;
  /** Comma-separated market keys, e.g. "h2h". */
  markets?: string;
  oddsFormat?: 'decimal' | 'american';
}

export interface TheOddsApiClient {
  getSports(): Promise<TheOddsApiSport[]>;
  getEvents(sportKey: string): Promise<TheOddsApiEvent[]>;
  getEventOdds(params: GetEventOddsParams): Promise<TheOddsApiEventOdds>;
}

/**
 * The Odds API bills by request cost (markets x regions), reported via
 * response headers rather than a flat rate limit - log it on every call so
 * real consumption is visible instead of guessed at.
 */
function logQuota(response: Response, label: string): void {
  const remaining = response.headers.get('x-requests-remaining');
  const used = response.headers.get('x-requests-used');
  const last = response.headers.get('x-requests-last');
  if (remaining !== null) {
    console.log(`${label}: quota remaining=${remaining} used=${used} lastCost=${last}`);
  }
}

async function errorFromResponse(response: Response, label: string): Promise<Error> {
  const body = await response.text().catch(() => '');
  return new Error(
    `the-odds-api ${label} failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`,
  );
}

export function createTheOddsApiClient(options: TheOddsApiClientOptions): TheOddsApiClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function getSports(): Promise<TheOddsApiSport[]> {
    const url = new URL(`${BASE_URL}/sports`);
    url.searchParams.set('apiKey', options.apiKey);

    const response = await fetchImpl(url.toString());
    logQuota(response, 'GET /sports');
    if (!response.ok) {
      throw await errorFromResponse(response, 'GET /sports');
    }
    return (await response.json()) as TheOddsApiSport[];
  }

  async function getEvents(sportKey: string): Promise<TheOddsApiEvent[]> {
    const url = new URL(`${BASE_URL}/sports/${sportKey}/events`);
    url.searchParams.set('apiKey', options.apiKey);
    url.searchParams.set('dateFormat', 'iso');

    const response = await fetchImpl(url.toString());
    const label = `GET /sports/${sportKey}/events`;
    logQuota(response, label);
    if (!response.ok) {
      throw await errorFromResponse(response, label);
    }
    return (await response.json()) as TheOddsApiEvent[];
  }

  async function getEventOdds(params: GetEventOddsParams): Promise<TheOddsApiEventOdds> {
    const { sportKey, eventId, regions = 'eu', markets = 'h2h', oddsFormat = 'decimal' } = params;
    const url = new URL(`${BASE_URL}/sports/${sportKey}/events/${eventId}/odds`);
    url.searchParams.set('apiKey', options.apiKey);
    url.searchParams.set('regions', regions);
    url.searchParams.set('markets', markets);
    url.searchParams.set('oddsFormat', oddsFormat);
    url.searchParams.set('dateFormat', 'iso');

    const response = await fetchImpl(url.toString());
    const label = `GET /sports/${sportKey}/events/${eventId}/odds`;
    logQuota(response, label);
    if (!response.ok) {
      throw await errorFromResponse(response, label);
    }
    return (await response.json()) as TheOddsApiEventOdds;
  }

  return { getSports, getEvents, getEventOdds };
}

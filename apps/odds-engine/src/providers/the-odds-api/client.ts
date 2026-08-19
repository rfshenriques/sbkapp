import type { TheOddsApiEventOdds, TheOddsApiSport } from './types';

const BASE_URL = 'https://api.the-odds-api.com/v4';

export interface TheOddsApiClientOptions {
  /**
   * One or more keys, tried in order - the free tier's 500 requests/month
   * cap means a single key running dry shouldn't take the board down. On
   * any failure (bad/exhausted key, network error) the client moves to the
   * next key; only once every key has failed does the call actually throw,
   * so callers (see events-service.ts's per-sport-key Promise.allSettled,
   * and server.ts's route .catch handlers) still get one clear error
   * message rather than a crash.
   */
  apiKeys: string[];
  fetchImpl?: typeof fetch;
}

export interface GetOddsParams {
  sportKey: string;
  /** Comma-separated region codes (us/uk/eu/au). */
  regions?: string;
  /**
   * Comma-separated market keys, e.g. "h2h" (the default). A request for a
   * market this sport/bookmaker/plan doesn't actually offer comes back as a
   * non-ok response for the *whole* sport key (see fetchWithKeyFallback) -
   * every match for that key then vanishes from the board, not just that
   * one market, so don't widen this beyond h2h without confirming the
   * additional market is actually available for every RELEVANT_SPORT_KEYS
   * entry against the real API first (a previous attempt at "h2h,totals"
   * caused most of the board - including live matches - to disappear).
   */
  markets?: string;
  oddsFormat?: 'decimal' | 'american';
}

export interface TheOddsApiClient {
  getSports(): Promise<TheOddsApiSport[]>;
  /**
   * One request returns every event AND its odds for the whole sport key -
   * confirmed against a real call (see events-service.ts's comment on why
   * this replaced the separate events-then-per-event-odds design).
   */
  getOdds(params: GetOddsParams): Promise<TheOddsApiEventOdds[]>;
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

/** Last 4 characters only - enough to tell keys apart in logs without printing the whole secret. */
function keyLabel(apiKey: string): string {
  return `...${apiKey.slice(-4)}`;
}

export function createTheOddsApiClient(options: TheOddsApiClientOptions): TheOddsApiClient {
  if (options.apiKeys.length === 0) {
    throw new Error('createTheOddsApiClient requires at least one API key');
  }
  const fetchImpl = options.fetchImpl ?? fetch;

  /**
   * Tries `buildUrl`'s request with each configured key in turn, returning
   * the first ok response. A non-ok response or a thrown network error both
   * count as "this key failed" and move on to the next one; the error from
   * the *last* key tried is what gets thrown once they're all exhausted, so
   * the final message reflects the most recent real failure rather than a
   * stale first one.
   */
  async function fetchWithKeyFallback(buildUrl: (apiKey: string) => URL, label: string): Promise<Response> {
    let lastError: unknown;
    for (const [index, apiKey] of options.apiKeys.entries()) {
      try {
        const response = await fetchImpl(buildUrl(apiKey).toString());
        logQuota(response, label);
        if (response.ok) {
          return response;
        }
        lastError = await errorFromResponse(response, label);
      } catch (error) {
        lastError = error;
      }

      const isLastKey = index === options.apiKeys.length - 1;
      const message = lastError instanceof Error ? lastError.message : String(lastError);
      if (isLastKey) {
        console.error(`${label}: key ${keyLabel(apiKey)} failed and no keys remain: ${message}`);
      } else {
        console.warn(`${label}: key ${keyLabel(apiKey)} failed (${message}), trying next key`);
      }
    }

    throw lastError instanceof Error
      ? new Error(`${label} failed on all ${options.apiKeys.length} configured key(s): ${lastError.message}`)
      : new Error(`${label} failed on all ${options.apiKeys.length} configured key(s)`);
  }

  async function getSports(): Promise<TheOddsApiSport[]> {
    const response = await fetchWithKeyFallback((apiKey) => {
      const url = new URL(`${BASE_URL}/sports`);
      url.searchParams.set('apiKey', apiKey);
      return url;
    }, 'GET /sports');
    return (await response.json()) as TheOddsApiSport[];
  }

  async function getOdds(params: GetOddsParams): Promise<TheOddsApiEventOdds[]> {
    // uk, not eu - our pricing source (Paddy Power, see normalize.ts) is a
    // UK/Ireland bookmaker and wasn't present in a real eu-region response
    // we checked. Also keeps request cost down (cost scales with region
    // count) since we only need the one region.
    const { sportKey, regions = 'uk', markets = 'h2h', oddsFormat = 'decimal' } = params;
    const label = `GET /sports/${sportKey}/odds`;

    const response = await fetchWithKeyFallback((apiKey) => {
      const url = new URL(`${BASE_URL}/sports/${sportKey}/odds`);
      url.searchParams.set('apiKey', apiKey);
      url.searchParams.set('regions', regions);
      url.searchParams.set('markets', markets);
      url.searchParams.set('oddsFormat', oddsFormat);
      url.searchParams.set('dateFormat', 'iso');
      return url;
    }, label);
    return (await response.json()) as TheOddsApiEventOdds[];
  }

  return { getSports, getOdds };
}

import type { Match } from '@sportsbook/shared';
import type { EventsService } from '../the-odds-api/events-service';
import type { TheRundownClient } from './client';
import { normalizeTheRundownEvent, RELEVANT_SPORT_IDS } from './normalize';

export type { EventsService };

/**
 * TheRundown's free tier is rate-limited per-second (1 req/sec), not a tight
 * monthly credit budget like the-odds-api - so unlike that provider's 24h
 * cache, there's no need to hoard requests. 5 minutes matches the free
 * tier's own documented data-freshness ceiling ("5 min delay") - polling
 * faster wouldn't see fresher data anyway, and a full sequential refresh
 * (RELEVANT_SPORT_IDS x 2 dates, ~1 req/sec) takes well under a minute.
 */
const EVENTS_CACHE_TTL_MS = 5 * 60_000;

const PARTIAL_FAILURE_CACHE_TTL_MS = 60_000;

/**
 * Spacing between outbound requests within one listMatches() refresh. The
 * free tier is capped at 1 req/sec - firing all ~20 (sport x date) requests
 * at once blows straight through that and gets most of them 429'd. A full
 * refresh at this spacing takes ~20s, well inside the 5-minute cache TTL.
 */
const DEFAULT_REQUEST_INTERVAL_MS = 1100;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface TheRundownEventsServiceOptions {
  client: TheRundownClient;
  sportIds?: typeof RELEVANT_SPORT_IDS;
  now?: () => number;
  /** Overridable in tests so a refresh doesn't take real seconds to run. */
  requestIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

function todayAndTomorrow(currentTime: number): string[] {
  const today = new Date(currentTime);
  const tomorrow = new Date(currentTime);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return [today, tomorrow].map((date) => date.toISOString().slice(0, 10));
}

/**
 * Same fetch-everything/cache/partial-failure shape as
 * the-odds-api/events-service.ts (see that file's own comments for the
 * reasoning) - one request per (sport, date) pair rather than one per sport
 * key, since this provider's events endpoint is date-scoped.
 */
export function createTheRundownEventsService(options: TheRundownEventsServiceOptions): EventsService {
  const {
    client,
    sportIds = RELEVANT_SPORT_IDS,
    now = Date.now,
    requestIntervalMs = DEFAULT_REQUEST_INTERVAL_MS,
    sleep = defaultSleep,
  } = options;

  let eventsCache: CacheEntry<Match[]> | undefined;

  async function listMatches(): Promise<Match[]> {
    const currentTime = now();
    if (eventsCache && eventsCache.expiresAt > currentTime) {
      return eventsCache.value;
    }

    const dates = todayAndTomorrow(currentTime);
    const requests = sportIds.flatMap((sport) => dates.map((date) => ({ sport, date })));

    // Sequential and spaced, not Promise.all - the free tier is 1 req/sec
    // and firing every (sport, date) request at once gets most of them
    // rate-limited, which is why the board would go from a handful of
    // matches to none between refreshes.
    const matches: Match[] = [];
    const seenIds = new Set<string>();
    let failedRequests = 0;
    for (const [index, { sport, date }] of requests.entries()) {
      if (index > 0) {
        await sleep(requestIntervalMs);
      }
      try {
        const events = await client.getEventsBySportAndDate({ sportId: sport.id, date });
        for (const event of events) {
          const match = normalizeTheRundownEvent(event);
          // today+tomorrow can return the same event twice (a match starting
          // right around the UTC day boundary) - de-dupe by our own prefixed id.
          if (match && !seenIds.has(match.id)) {
            seenIds.add(match.id);
            matches.push(match);
          }
        }
      } catch (error) {
        failedRequests += 1;
        console.error(
          `therundown listMatches: ${sport.competition} on ${date} failed:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.log(
      `therundown listMatches: ${requests.length} requests (${failedRequests} failed) -> ${matches.length} events`,
    );

    matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

    // Same reasoning as the-odds-api/events-service.ts: if every request
    // failed, leave the cache untouched so the next call retries rather
    // than latching onto an empty result.
    if (requests.length > 0 && failedRequests === requests.length) {
      return matches;
    }

    const ttl = failedRequests > 0 ? PARTIAL_FAILURE_CACHE_TTL_MS : EVENTS_CACHE_TTL_MS;
    eventsCache = { value: matches, expiresAt: currentTime + ttl };
    return matches;
  }

  async function getMatchOdds(eventId: string): Promise<Match | undefined> {
    const matches = await listMatches();
    return matches.find((match) => match.id === eventId);
  }

  return { listMatches, getMatchOdds };
}

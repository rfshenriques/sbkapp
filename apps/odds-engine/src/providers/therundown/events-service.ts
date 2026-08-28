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
 * faster wouldn't see fresher data anyway, and this still keeps a full
 * refresh (RELEVANT_SPORT_IDS x 2 dates) well clear of the per-second limit
 * when spread across a 5-minute window.
 */
const EVENTS_CACHE_TTL_MS = 5 * 60_000;

const PARTIAL_FAILURE_CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface TheRundownEventsServiceOptions {
  client: TheRundownClient;
  sportIds?: typeof RELEVANT_SPORT_IDS;
  now?: () => number;
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
  const { client, sportIds = RELEVANT_SPORT_IDS, now = Date.now } = options;

  let eventsCache: CacheEntry<Match[]> | undefined;

  async function listMatches(): Promise<Match[]> {
    const currentTime = now();
    if (eventsCache && eventsCache.expiresAt > currentTime) {
      return eventsCache.value;
    }

    const dates = todayAndTomorrow(currentTime);
    const requests = sportIds.flatMap((sport) => dates.map((date) => ({ sport, date })));

    const results = await Promise.allSettled(
      requests.map(({ sport, date }) => client.getEventsBySportAndDate({ sportId: sport.id, date })),
    );

    const matches: Match[] = [];
    const seenIds = new Set<string>();
    let failedRequests = 0;
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') {
        failedRequests += 1;
        const { sport, date } = requests[index]!;
        console.error(
          `therundown listMatches: ${sport.competition} on ${date} failed:`,
          result.reason instanceof Error ? result.reason.message : result.reason,
        );
        continue;
      }
      for (const event of result.value) {
        const match = normalizeTheRundownEvent(event);
        // today+tomorrow can return the same event twice (a match starting
        // right around the UTC day boundary) - de-dupe by our own prefixed id.
        if (match && !seenIds.has(match.id)) {
          seenIds.add(match.id);
          matches.push(match);
        }
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

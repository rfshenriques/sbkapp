import type { Match } from '@sportsbook/shared';
import type { TheOddsApiClient } from './client';
import { normalizeTheOddsApiEvent, normalizeTheOddsApiEventOdds } from './normalize';

const EVENTS_CACHE_TTL_MS = 5 * 60_000;
const ODDS_CACHE_TTL_MS = 2 * 60_000;

/**
 * The Odds API has no single "all football" endpoint the way odds-api.io
 * did - each competition is its own sport key, each requiring its own
 * request. This curated list replaces the old post-hoc league-name filter:
 * we only ever ask for the competitions we want, rather than requesting
 * everything and filtering client-side.
 *
 * These keys are best-effort from The Odds API's public documentation, not
 * verified against a live GET /v4/sports call from this sandbox (no
 * outbound network access here). verifySportKeys below cross-checks them
 * against the real sports list on startup so a wrong/renamed key shows up
 * immediately in logs instead of silently returning zero events for that
 * competition.
 */
export const RELEVANT_SPORT_KEYS = [
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_portugal_primeira_liga',
  'soccer_netherlands_eredivisie',
  'soccer_uefa_champs_league',
  'soccer_uefa_champs_league_qualification',
  'soccer_uefa_europa_league',
  'soccer_uefa_europa_conference_league',
  'soccer_uefa_nations_league',
  'soccer_fifa_world_cup',
];

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface EventsServiceOptions {
  client: TheOddsApiClient;
  sportKeys?: string[];
  now?: () => number;
}

export interface EventsService {
  /** Fixture list only (no markets) — cheap, cached, safe to call on every board load. */
  listMatches(): Promise<Match[]>;
  /** Fetches markets for one event on demand, e.g. when a user opens a match. */
  getMatchOdds(eventId: string): Promise<Match | undefined>;
}

/**
 * One-time (per process) startup check: fetches the real sports list and
 * logs which of our configured RELEVANT_SPORT_KEYS aren't present/active,
 * so a bad key is a log line, not a silent empty board.
 */
export async function verifySportKeys(client: TheOddsApiClient, sportKeys: string[]): Promise<void> {
  try {
    const sports = await client.getSports();
    const activeKeys = new Set(sports.filter((sport) => sport.active).map((sport) => sport.key));
    const missing = sportKeys.filter((key) => !activeKeys.has(key));
    if (missing.length > 0) {
      console.warn(
        `verifySportKeys: these configured sport keys are missing or inactive right now: ${missing.join(', ')}`,
      );
    } else {
      console.log('verifySportKeys: all configured sport keys are active.');
    }
  } catch (error) {
    console.error(
      'verifySportKeys: failed to fetch /v4/sports:',
      error instanceof Error ? error.message : error,
    );
  }
}

export function createEventsService(options: EventsServiceOptions): EventsService {
  const { client, sportKeys = RELEVANT_SPORT_KEYS, now = Date.now } = options;

  let eventsCache: CacheEntry<Match[]> | undefined;
  // The odds endpoint is a path per sport key, so we need to remember which
  // sport each event belongs to in order to fetch its odds on demand.
  let sportKeyByEventId = new Map<string, string>();
  const oddsCache = new Map<string, CacheEntry<Match>>();

  async function listMatches(): Promise<Match[]> {
    const currentTime = now();
    if (eventsCache && eventsCache.expiresAt > currentTime) {
      return eventsCache.value;
    }

    const results = await Promise.allSettled(
      sportKeys.map(async (sportKey) => ({ sportKey, events: await client.getEvents(sportKey) })),
    );

    const nextSportKeyByEventId = new Map<string, string>();
    const matches: Match[] = [];
    let failedSportKeys = 0;
    for (const result of results) {
      if (result.status === 'rejected') {
        failedSportKeys += 1;
        console.error(
          'listMatches: a sport key request failed:',
          result.reason instanceof Error ? result.reason.message : result.reason,
        );
        continue;
      }
      const { sportKey, events } = result.value;
      for (const event of events) {
        nextSportKeyByEventId.set(event.id, sportKey);
        matches.push(normalizeTheOddsApiEvent(event, now));
      }
    }

    console.log(
      `listMatches: ${sportKeys.length} sport keys queried (${failedSportKeys} failed) -> ${matches.length} events`,
    );

    matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

    sportKeyByEventId = nextSportKeyByEventId;
    eventsCache = { value: matches, expiresAt: currentTime + EVENTS_CACHE_TTL_MS };
    return matches;
  }

  async function getMatchOdds(eventId: string): Promise<Match | undefined> {
    const currentTime = now();
    const cached = oddsCache.get(eventId);
    if (cached && cached.expiresAt > currentTime) {
      return cached.value;
    }

    const sportKey = sportKeyByEventId.get(eventId);
    if (!sportKey) {
      // Not in the most recent listMatches result (expired cache, or an
      // unknown/stale id) - no sport key to query odds with.
      return undefined;
    }

    let match: Match | undefined;
    try {
      const raw = await client.getEventOdds({ sportKey, eventId });
      match = normalizeTheOddsApiEventOdds(raw, now);
    } catch (error) {
      // The event itself is real (it came from a recent listMatches call)
      // even when the provider can't price it - fall back to the odds-less
      // event rather than surfacing "not found" for "no odds available".
      const fallback = eventsCache?.value.find((cachedMatch) => cachedMatch.id === eventId);
      if (!fallback) {
        throw error;
      }
      console.error(
        `getMatchOdds(${eventId}) failed, returning event without odds:`,
        error instanceof Error ? error.message : error,
      );
      match = fallback;
    }

    oddsCache.set(eventId, { value: match, expiresAt: currentTime + ODDS_CACHE_TTL_MS });
    return match;
  }

  return { listMatches, getMatchOdds };
}

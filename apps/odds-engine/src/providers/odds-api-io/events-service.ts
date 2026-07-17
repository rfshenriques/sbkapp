import type { Match } from '../../domain/odds';
import type { OddsApiIoClient } from './client';
import { DEFAULT_BOOKMAKER, normalizeOddsApiIoResponse } from './normalize';

const EVENTS_CACHE_TTL_MS = 60_000;
const ODDS_CACHE_TTL_MS = 20_000;
const RELEVANT_STATUSES = new Set(['pending', 'live']);

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface EventsServiceOptions {
  client: OddsApiIoClient;
  sport?: string;
  eventsLimit?: number;
  bookmaker?: string;
  now?: () => number;
}

export interface EventsService {
  /** Fixture list only (no markets) — cheap, cached, safe to call on every board load. */
  listMatches(): Promise<Match[]>;
  /** Fetches markets for one event on demand, e.g. when a user opens a match. */
  getMatchOdds(eventId: string): Promise<Match | undefined>;
}

/**
 * Wraps the odds-api.io client with the on-demand fetch strategy: the events
 * list never carries markets (so browsing the board costs one request per
 * cache window, not one per event), and per-event odds are only fetched -
 * and briefly cached - when getMatchOdds is actually called. This keeps us
 * well inside the free tier's 100 requests/hour.
 */
export function createEventsService(options: EventsServiceOptions): EventsService {
  const {
    client,
    sport = 'football',
    eventsLimit = 30,
    bookmaker = DEFAULT_BOOKMAKER,
    now = Date.now,
  } = options;

  let eventsCache: CacheEntry<Match[]> | undefined;
  const oddsCache = new Map<string, CacheEntry<Match>>();

  async function listMatches(): Promise<Match[]> {
    const currentTime = now();
    if (eventsCache && eventsCache.expiresAt > currentTime) {
      return eventsCache.value;
    }

    const events = await client.getEvents({ sport, limit: eventsLimit });
    const matches: Match[] = events
      .filter((event) => RELEVANT_STATUSES.has(event.status))
      .map((event) => ({
        id: String(event.id),
        competition: event.league.name,
        homeTeam: event.home,
        awayTeam: event.away,
        kickoff: event.date,
        isLive: event.status === 'live',
        markets: [],
      }))
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

    eventsCache = { value: matches, expiresAt: currentTime + EVENTS_CACHE_TTL_MS };
    return matches;
  }

  async function getMatchOdds(eventId: string): Promise<Match | undefined> {
    const currentTime = now();
    const cached = oddsCache.get(eventId);
    if (cached && cached.expiresAt > currentTime) {
      return cached.value;
    }

    const raw = await client.getOdds(Number(eventId));
    const match = normalizeOddsApiIoResponse(raw, bookmaker);
    oddsCache.set(eventId, { value: match, expiresAt: currentTime + ODDS_CACHE_TTL_MS });
    return match;
  }

  return { listMatches, getMatchOdds };
}

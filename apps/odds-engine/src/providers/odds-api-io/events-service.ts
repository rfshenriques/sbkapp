import type { Match } from '@sportsbook/shared';
import type { OddsApiIoClient } from './client';
import { DEFAULT_BOOKMAKER, normalizeOddsApiIoResponse } from './normalize';

// Deliberately generous: a dev-server restart burns one request regardless
// of TTL, and it's easy to restart several times in a debugging session.
const EVENTS_CACHE_TTL_MS = 5 * 60_000;
const ODDS_CACHE_TTL_MS = 2 * 60_000;
const RELEVANT_STATUSES = new Set(['pending', 'live']);

/**
 * A global football feed is dominated by small regional matches kicking off
 * today, which buries the competitions our two bookmakers actually tend to
 * cover (majors, internationals). This is a heuristic guess, not confirmed
 * bookmaker coverage - it just biases sort order, it doesn't filter anything out.
 */
const PRIORITY_COMPETITION_KEYWORDS = [
  'world cup',
  'champions league',
  'europa league',
  'premier league',
  'la liga',
  'serie a',
  'bundesliga',
  'ligue 1',
  'international',
];

function competitionPriority(competition: string): number {
  const lower = competition.toLowerCase();
  const index = PRIORITY_COMPETITION_KEYWORDS.findIndex((keyword) => lower.includes(keyword));
  return index === -1 ? PRIORITY_COMPETITION_KEYWORDS.length : index;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface EventsServiceOptions {
  client: OddsApiIoClient;
  sport?: string;
  /** How many raw fixtures to request from the provider before filtering to pending/live. */
  eventsLimit?: number;
  /** How many pending/live matches to actually return, after filtering. */
  maxMatches?: number;
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
    eventsLimit = 300,
    maxMatches = 40,
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
      .sort((a, b) => {
        const priorityDiff =
          competitionPriority(a.competition) - competitionPriority(b.competition);
        return priorityDiff !== 0 ? priorityDiff : a.kickoff.localeCompare(b.kickoff);
      })
      .slice(0, maxMatches);

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

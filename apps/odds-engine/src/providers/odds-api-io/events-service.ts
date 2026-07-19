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
 * bookmaker coverage - it just biases sort order among matches already
 * accepted by isRelevantLeague below.
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

/**
 * Testing-phase board filter: restrict to European domestic leagues plus
 * major continental/international competitions (including qualifiers, e.g.
 * "UEFA Champions League Qualifying" matches via the substring below) -
 * matches our free-tier bookmakers (Betclic PT, Betano PT) are actually
 * likely to price, instead of burning odds-api.io's requests-per-hour
 * budget on fixtures they don't cover at all. "International" is meant to
 * catch national-team friendlies/qualifiers, not club preseason
 * friendlies, hence the explicit exclusion below. league.name format is
 * "Country - Competition" or "International - Competition" (e.g.
 * "Bundesliga", "International - FIFA World Cup") - exact keyword list is
 * expected to need tuning once we see more real league names in
 * production logs.
 */
const RELEVANT_LEAGUE_KEYWORDS = [
  'champions league',
  'europa league',
  'conference league',
  'nations league',
  'world cup',
  'euro qualif',
  'premier league',
  'la liga',
  'bundesliga',
  'serie a',
  'ligue 1',
  'eredivisie',
  'primeira liga', // Portugal - closest overlap with our PT bookmakers.
  'international',
];

const EXCLUDED_LEAGUE_KEYWORDS = ['club friendly'];

function isRelevantLeague(leagueName: string): boolean {
  const lower = leagueName.toLowerCase();
  if (EXCLUDED_LEAGUE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return false;
  }
  return RELEVANT_LEAGUE_KEYWORDS.some((keyword) => lower.includes(keyword));
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
      .filter((event) => isRelevantLeague(event.league.name))
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

    let match: Match | undefined;
    try {
      const raw = await client.getOdds(Number(eventId));
      match = normalizeOddsApiIoResponse(raw, bookmaker);
    } catch (error) {
      // The event itself is real (it came from a recent listMatches call) even
      // when odds-api.io can't price it - a provider-side rejection (wrong
      // bookmaker access, no coverage for this fixture, etc.) isn't the same
      // as the match not existing, so fall back to the odds-less event rather
      // than surfacing "not found" for what's actually "no odds available".
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

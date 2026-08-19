import type { Match } from '@sportsbook/shared';
import type { TheOddsApiClient } from './client';
import { isLikelyLive, normalizeTheOddsApiEventOdds } from './normalize';

/**
 * The Odds API's free tier is 500 requests/MONTH total (confirmed via the
 * x-requests-remaining header - see logQuota in client.ts), not the
 * requests-per-hour budget odds-api.io had. listMatches costs one request
 * per configured sport key, so a short TTL is dangerous: at odds-api.io's
 * old 5-minute value this could exhaust the entire month's quota within
 * hours of real traffic. 24h keeps this to one request per sport key per
 * day, leaving comfortable headroom. Revisit once on a paid tier.
 */
const EVENTS_CACHE_TTL_MS = 24 * 60 * 60_000;

/**
 * Curated list of sport keys to query - the-odds-api.com has no single
 * "all football" endpoint the way odds-api.io did, so this replaces the old
 * post-hoc league-name filter: we only ever request the competitions we
 * want, instead of requesting everything and filtering client-side.
 *
 * Cross-checked against a real GET /v4/sports response (2026-07-19):
 * confirmed active/real are soccer_epl, soccer_spain_la_liga,
 * soccer_germany_bundesliga, soccer_italy_serie_a, soccer_france_ligue_one,
 * soccer_netherlands_eredivisie, soccer_uefa_champs_league_qualification,
 * soccer_fifa_world_cup, icehockey_nhl, americanfootball_nfl,
 * mma_mixed_martial_arts, boxing_boxing. Dropped: soccer_portugal_primeira_liga
 * (doesn't exist under that or any similar key in the real list) and
 * soccer_uefa_champs_league / soccer_uefa_europa_league /
 * soccer_uefa_europa_conference_league / soccer_uefa_nations_league (none
 * appeared in the "in season" list - the group stages/Nations League
 * windows haven't started yet in mid-July, and the endpoint only lists
 * in-season sports by default, so these may reappear once their windows
 * open rather than being permanently wrong keys).
 *
 * Deliberately excluded from the real list even though confirmed active:
 * any *_winner / *_championship_winner key (outright/futures markets, not
 * per-game h2h - incompatible with the markets=h2h fetch this provider
 * uses) and the more regional sports (CFL, NCAAF, AFL, KBO/MiLB/NPB
 * baseball, cricket formats, lacrosse, NRL) to keep per-refresh request
 * count down given the tight monthly quota - see the cache-TTL comment
 * above. At 12 keys x 1 request/24h, each request now costing 2 quota
 * units (markets=h2h,totals - see client.ts's default), this is
 * ~720 units/month against the 500/month free-tier cap. This is expected
 * to run over the free tier over a full month; a stale cache (last
 * fetched result kept until the next successful call - see
 * `if (... failedSportKeys === sportKeys.length) return matches;` below)
 * degrades this to "board stops updating" rather than "board goes empty"
 * once the quota is exhausted. Revisit (fewer sport keys, or a paid plan)
 * if this isn't an acceptable tradeoff.
 *
 * Other confirmed-real European leagues not included here for the same
 * quota reason - add if broader coverage is wanted: soccer_efl_champ
 * (England Championship), soccer_austria_bundesliga,
 * soccer_belgium_first_div, soccer_denmark_superliga,
 * soccer_norway_eliteserien, soccer_poland_ekstraklasa, soccer_spl
 * (Scotland), soccer_sweden_allsvenskan, soccer_switzerland_superleague.
 */
export const RELEVANT_SPORT_KEYS = [
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_netherlands_eredivisie',
  'soccer_uefa_champs_league_qualification',
  'soccer_fifa_world_cup',
  'icehockey_nhl',
  'americanfootball_nfl',
  'mma_mixed_martial_arts',
  'boxing_boxing',
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
  /** All configured leagues' events, odds already embedded (see client.ts). */
  listMatches(): Promise<Match[]>;
  /** Looks up one event from the same cached list - no extra request. */
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

  /**
   * isLive is a function of kickoff + the current time, not of anything the
   * feed itself reports (see isLikelyLive) - baking it into the cached
   * Match objects would freeze it at whatever it was when the 24h cache was
   * last populated, so a match that kicks off partway through that window
   * would sit at isLive: false (never showing live score/tracker UI, and
   * never appearing in the live-matches strip) until the next cache
   * refresh, up to 24h later. Recompute fresh on every read instead,
   * whether the read comes from cache or a fresh fetch.
   */
  function withFreshLiveFlags(matches: Match[], currentTime: number): Match[] {
    return matches.map((match) => ({ ...match, isLive: isLikelyLive(match.kickoff, () => currentTime) }));
  }

  async function listMatches(): Promise<Match[]> {
    const currentTime = now();
    if (eventsCache && eventsCache.expiresAt > currentTime) {
      return withFreshLiveFlags(eventsCache.value, currentTime);
    }

    const results = await Promise.allSettled(
      sportKeys.map((sportKey) => client.getOdds({ sportKey })),
    );

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
      for (const event of result.value) {
        matches.push(normalizeTheOddsApiEventOdds(event, now));
      }
    }

    console.log(
      `listMatches: ${sportKeys.length} sport keys queried (${failedSportKeys} failed) -> ${matches.length} events`,
    );

    matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

    // Every sport key failed (e.g. the API key was invalid/exhausted at the
    // moment this call happened) - caching an empty result here would latch
    // the whole service onto "no matches" for the full TTL even after the
    // underlying problem is fixed, requiring a process restart to clear.
    // Leave the cache untouched so the next call retries against the API
    // instead of serving this transient empty result for hours.
    if (sportKeys.length > 0 && failedSportKeys === sportKeys.length) {
      return withFreshLiveFlags(matches, currentTime);
    }

    eventsCache = { value: matches, expiresAt: currentTime + EVENTS_CACHE_TTL_MS };
    return withFreshLiveFlags(matches, currentTime);
  }

  async function getMatchOdds(eventId: string): Promise<Match | undefined> {
    const matches = await listMatches();
    return matches.find((match) => match.id === eventId);
  }

  return { listMatches, getMatchOdds };
}

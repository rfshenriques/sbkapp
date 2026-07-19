import type { Market, Match, Selection } from '@sportsbook/shared';
import type { TheOddsApiBookmaker, TheOddsApiEventOdds, TheOddsApiOutcome } from './types';

/**
 * the-odds-api.com's event objects carry sport_key/sport_title but no
 * human-readable "group" (that only appears on GET /v4/sports, a separate
 * call we don't want to spend quota making per event). Since
 * RELEVANT_SPORT_KEYS in events-service.ts is a small, fixed, curated list,
 * a static prefix map is simpler and free - add an entry here whenever a
 * new sport key is added there.
 */
const SPORT_LABEL_BY_KEY_PREFIX: Record<string, string> = {
  soccer_: 'Football',
  icehockey_: 'Ice Hockey',
  americanfootball_: 'American Football',
  mma_: 'MMA',
  boxing_: 'Boxing',
};

function sportLabelForKey(sportKey: string): string {
  const prefix = Object.keys(SPORT_LABEL_BY_KEY_PREFIX).find((candidate) =>
    sportKey.startsWith(candidate),
  );
  return prefix ? (SPORT_LABEL_BY_KEY_PREFIX[prefix] as string) : sportKey;
}

/**
 * Same reasoning as SPORT_LABEL_BY_KEY_PREFIX above, but exact-key rather
 * than prefix-matched since country doesn't follow a shared prefix pattern
 * the way sport does - one entry per key in RELEVANT_SPORT_KEYS
 * (events-service.ts). Add an entry here whenever a new sport key is added
 * there, or new matches from it will fall through to sportLabelForKey's
 * raw key rather than a real country.
 */
const COUNTRY_BY_SPORT_KEY: Record<string, string> = {
  soccer_epl: 'England',
  soccer_spain_la_liga: 'Spain',
  soccer_germany_bundesliga: 'Germany',
  soccer_italy_serie_a: 'Italy',
  soccer_france_ligue_one: 'France',
  soccer_netherlands_eredivisie: 'Netherlands',
  soccer_uefa_champs_league_qualification: 'Europe',
  soccer_fifa_world_cup: 'World',
  icehockey_nhl: 'USA',
  americanfootball_nfl: 'USA',
  mma_mixed_martial_arts: 'International',
  boxing_boxing: 'International',
};

function countryForKey(sportKey: string): string {
  return COUNTRY_BY_SPORT_KEY[sportKey] ?? 'International';
}

/**
 * Single preferred pricing source - Paddy Power, expected to offer deeper
 * market coverage once on a paid the-odds-api.com plan. Matched as a
 * substring, not an exact title match, since a real response we checked
 * had bookmaker titles carrying a country suffix (e.g. "Betclic (FR)", key
 * "betclic_fr") - an exact-equality check would never match those.
 */
const PREFERRED_BOOKMAKER_TITLES = ['Paddy Power'];

/**
 * This endpoint has no explicit "still live" field (unlike odds-api.io's
 * status enum) - approximate as "kicked off within the last ~3 hours"
 * (typical match length plus stoppage/halftime). Real live state (score,
 * clock, events) still comes from the separate api-sports.io tracker; this
 * is only used to decide which board section a match belongs in.
 */
const LIVE_WINDOW_MS = 3 * 60 * 60_000;

export function isLikelyLive(commenceTime: string, now: () => number = Date.now): boolean {
  const elapsed = now() - new Date(commenceTime).getTime();
  return elapsed >= 0 && elapsed <= LIVE_WINDOW_MS;
}

function pickBookmaker(bookmakers: TheOddsApiBookmaker[]): TheOddsApiBookmaker | undefined {
  for (const title of PREFERRED_BOOKMAKER_TITLES) {
    const found = bookmakers.find((bookmaker) =>
      bookmaker.title.toLowerCase().includes(title.toLowerCase()),
    );
    if (found) {
      return found;
    }
  }
  return bookmakers[0];
}

function toMatchResultSelections(
  outcomes: TheOddsApiOutcome[],
  homeTeam: string,
  awayTeam: string,
): Selection[] {
  return outcomes.map((outcome) => {
    if (outcome.name === homeTeam) {
      return { id: 'home', name: 'Home', odds: outcome.price };
    }
    if (outcome.name === awayTeam) {
      return { id: 'away', name: 'Away', odds: outcome.price };
    }
    return { id: 'draw', name: 'Draw', odds: outcome.price };
  });
}

/**
 * Maps a raw per-league odds response entry (one event, its own odds
 * embedded) to our internal Match/Market/Selection shape, taking the h2h
 * market from a single preferred bookmaker (mirrors odds-api.io's
 * DEFAULT_BOOKMAKER approach - see PROJECT_BRIEF.md odds ingestion notes).
 */
export function normalizeTheOddsApiEventOdds(raw: TheOddsApiEventOdds, now?: () => number): Match {
  const bookmaker = raw.bookmakers.length > 0 ? pickBookmaker(raw.bookmakers) : undefined;
  const h2h = bookmaker?.markets.find((market) => market.key === 'h2h');

  const markets: Market[] = h2h
    ? [
        {
          id: 'match-result',
          name: 'Match Result',
          selections: toMatchResultSelections(h2h.outcomes, raw.home_team, raw.away_team),
        },
      ]
    : [];

  return {
    id: raw.id,
    sport: sportLabelForKey(raw.sport_key),
    country: countryForKey(raw.sport_key),
    competition: raw.sport_title,
    homeTeam: raw.home_team,
    awayTeam: raw.away_team,
    kickoff: raw.commence_time,
    isLive: isLikelyLive(raw.commence_time, now),
    markets,
  };
}

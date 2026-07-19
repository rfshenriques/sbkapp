import type { Market, Match, Selection } from '@sportsbook/shared';
import type { TheOddsApiBookmaker, TheOddsApiEventOdds, TheOddsApiOutcome } from './types';

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
    competition: raw.sport_title,
    homeTeam: raw.home_team,
    awayTeam: raw.away_team,
    kickoff: raw.commence_time,
    isLive: isLikelyLive(raw.commence_time, now),
    markets,
  };
}

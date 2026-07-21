import type { LiveMatchState } from '@sportsbook/shared';

// Same-origin path - Vite's dev server proxies /api to the odds-engine (see
// vite.config.ts), so the browser never needs a second URL or CORS at all.
// Matches/odds themselves are NOT fetched from here any more (see
// backendApi.ts's getMatches/getMatchById) - odds-engine only serves raw
// feed prices, and player-facing odds need the acting brand's margin
// applied first, which only the backend can do. This file now only covers
// the live in-play score/stats endpoint, which carries no odds.
const BASE_URL = '/api';

/**
 * 404 means either the match isn't live, or it is but no matching live
 * fixture could be resolved from the live-data provider (see
 * apps/odds-engine's api-sports match-fixture-mapper) - both are
 * "no live data to show" from the UI's point of view, not an error.
 */
export async function fetchLiveMatch(matchId: string): Promise<LiveMatchState | undefined> {
  const response = await fetch(`${BASE_URL}/events/${encodeURIComponent(matchId)}/live`);
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch live state for match ${matchId}: ${response.status}`);
  }
  return (await response.json()) as LiveMatchState;
}

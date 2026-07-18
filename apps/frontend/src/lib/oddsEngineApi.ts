import type { LiveMatchState, Match } from '@sportsbook/shared';

// Same-origin path - Vite's dev server proxies /api to the odds-engine (see
// vite.config.ts), so the browser never needs a second URL or CORS at all.
const BASE_URL = '/api';

export async function fetchMatches(): Promise<Match[]> {
  const response = await fetch(`${BASE_URL}/events`);
  if (!response.ok) {
    throw new Error(`Failed to fetch matches: ${response.status}`);
  }
  return (await response.json()) as Match[];
}

export async function fetchMatchById(matchId: string): Promise<Match | undefined> {
  const response = await fetch(`${BASE_URL}/events/${encodeURIComponent(matchId)}`);
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch match ${matchId}: ${response.status}`);
  }
  return (await response.json()) as Match;
}

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

import type { Match } from '@sportsbook/shared';

// Same-origin path - Vite's dev server proxies /api to the odds-engine (see
// vite.config.ts), same pattern as apps/frontend.
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

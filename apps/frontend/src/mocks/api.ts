import { mockMatches } from './matches';
import type { Match } from './types';

const SIMULATED_LATENCY_MS = 400;

function delay<T>(value: T, ms = SIMULATED_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function fetchMatches(): Promise<Match[]> {
  return delay(mockMatches);
}

export function fetchMatchById(matchId: string): Promise<Match | undefined> {
  return delay(mockMatches.find((match) => match.id === matchId));
}

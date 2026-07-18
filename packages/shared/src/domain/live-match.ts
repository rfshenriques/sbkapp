export type LiveMatchEventType = 'goal' | 'card' | 'substitution' | 'var';

export interface LiveMatchEvent {
  minute: number;
  extraMinute?: number;
  type: LiveMatchEventType;
  team: 'home' | 'away';
  player: string;
  /** Provider-specific detail text, e.g. "Normal Goal", "Yellow Card", "Substitution 1". */
  detail: string;
  /** The scorer's assist, when the event is a goal and one is recorded. */
  assistPlayer?: string;
}

export interface LiveMatchStat {
  /** e.g. "Shots on Goal", "Corner Kicks", "Ball Possession", "Yellow Cards" */
  type: string;
  home: number | string;
  away: number | string;
}

/**
 * Not a field any provider returns - derived server-side from recent
 * attacking activity (see computeMomentum in the api-sports provider).
 * home + away always sum to 100.
 */
export interface LiveMatchMomentum {
  home: number;
  away: number;
}

export interface LiveMatchState {
  matchId: string;
  minute: number;
  homeScore: number;
  awayScore: number;
  events: LiveMatchEvent[];
  stats: LiveMatchStat[];
  momentum: LiveMatchMomentum;
  updatedAt: string;
}

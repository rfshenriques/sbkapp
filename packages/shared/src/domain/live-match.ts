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
  /** Provider status code for which part of the match is currently in progress, e.g. '1H', 'HT', '2H', 'ET', 'P' - see matchPeriodLabel for the player-facing label. */
  period: string;
  homeScore: number;
  awayScore: number;
  events: LiveMatchEvent[];
  stats: LiveMatchStat[];
  momentum: LiveMatchMomentum;
  updatedAt: string;
}

/**
 * Score + clock only, no events/stats/momentum - the cheap, always-on
 * scoreboard (see LiveScoreboardService in apps/odds-engine) that covers
 * every currently-live match in a single upstream request, unlike
 * LiveMatchState's fuller per-match tracker (events, stats - 3 requests,
 * one match at a time, see LiveTrackerService's own budget comment). Match
 * cards and the live-matches strip use this so a score/clock actually shows
 * for every live match at once, not just whichever one happens to be the
 * single match LiveMatchState is currently tracking.
 */
export interface LiveScoreboardEntry {
  matchId: string;
  minute: number;
  period: string;
  homeScore: number;
  awayScore: number;
  updatedAt: string;
}

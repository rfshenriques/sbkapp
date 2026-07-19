export interface Selection {
  id: string;
  name: string;
  /** Decimal odds, e.g. 1.85 */
  odds: number;
}

export interface Market {
  id: string;
  name: string;
  selections: Selection[];
}

export interface Match {
  id: string;
  /** Human-readable sport grouping, e.g. "Football", "Ice Hockey" - powers per-sport filtering on the board. */
  sport: string;
  /** Human-readable country/region the competition belongs to, e.g. "England", "International" - powers the sidebar's sport > country > competition drill-down. */
  country: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  isLive: boolean;
  markets: Market[];
}

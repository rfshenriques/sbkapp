export interface Selection {
  id: string;
  name: string;
  /** Decimal odds, e.g. 1.85 */
  odds: number;
  /** Present only when a trader-configured boost bumped this selection's price up the odds ladder - the price a player would have seen without it. */
  originalOdds?: number;
}

export interface Market {
  id: string;
  name: string;
  selections: Selection[];
  /** True for a trader-created manual market with no feed equivalent - the player app groups every such market under one "Specials" heading rather than interspersing them with real markets. */
  isSpecial?: boolean;
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

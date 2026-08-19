/**
 * A price this low pays out almost nothing over stake and is usually a
 * feed/pricing glitch rather than a genuine market - selections at or below
 * this are locked out (see MarketSelections.tsx's isSuspended, PamService's
 * placeBet) the same way a trader-suspended selection is, without needing a
 * trader to suspend it by hand.
 */
export const MIN_BETTABLE_ODDS = 1.02;

export interface Selection {
  id: string;
  name: string;
  /** Decimal odds, e.g. 1.85 */
  odds: number;
  /** Present only when a trader-configured boost bumped this selection's price up the odds ladder - the price a player would have seen without it. */
  originalOdds?: number;
  /** Present only alongside originalOdds when the boost has a per-bet stake cap - shown to players so they know the boosted price only applies up to this stake. In cents. */
  maxStakeCents?: number;
}

export interface Market {
  id: string;
  name: string;
  selections: Selection[];
  /** True for a trader-created manual market with no feed equivalent - the player app groups every such market under one "Specials" heading rather than interspersing them with real markets. */
  isSpecial?: boolean;
  /** Present only for manual markets with a trader-configured per-bet stake cap - applies to any selection within this market. In cents. */
  maxStakeCents?: number;
  /** True only for a manual market a trader flagged as accumulator-incompatible (see PamService) - a selection from this market can only ever be bet as a single. */
  singlesOnly?: boolean;
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

/** One boosted selection, flattened out of its match/market for the player-facing Boosts page - see GET /public/boosts/:brandId. */
export interface BoostedSelectionSummary {
  matchId: string;
  sport: string;
  country: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  isLive: boolean;
  marketId: string;
  marketName: string;
  selectionId: string;
  selectionName: string;
  /** The price a player would have seen without the boost. */
  previousOdds: number;
  /** The boosted price. */
  odds: number;
  /** In cents - present only when the boost has a per-bet stake cap. */
  maxStakeCents?: number;
}

/**
 * TheRundown v2 Sports Odds API response shapes - trimmed to the fields
 * this provider actually reads. See
 * https://docs.therundown.io/introduction (V2 endpoints use market-based
 * data structures: market_id, participants, line prices - V1's legacy
 * moneyline/spread/total objects are intentionally not modeled here).
 */

export interface TheRundownSport {
  sport_id: number;
  sport_name: string;
}

export interface TheRundownSportsResponse {
  sports: TheRundownSport[];
}

export interface TheRundownTeam {
  team_id: number;
  name: string;
  mascot: string;
  abbreviation: string;
  record?: string;
  is_home: boolean;
  is_away: boolean;
}

export interface TheRundownScore {
  /**
   * e.g. STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL,
   * STATUS_POSTPONED, STATUS_CANCELED, STATUS_SUSPENDED, STATUS_HALFTIME,
   * STATUS_OVERTIME - see the API's Score schema for the full set.
   */
  event_status: string;
  score_away?: number;
  score_home?: number;
  game_clock?: number;
  display_clock?: string;
  game_period?: number;
  event_status_detail?: string;
}

/** American-odds price for one line, keyed by affiliate/sportsbook ID in the parent MarketLine's `prices` map. */
export interface TheRundownMarketLinePrice {
  /** American odds. A value of exactly 0.0001 means "off the board" (pricing temporarily pulled) - not an error. */
  price: number;
  is_main_line: boolean;
  updated_at: string;
}

export interface TheRundownMarketLine {
  /** Numeric line value (spread/total) as a string, or empty for a moneyline. */
  value: string;
  /** American-odds prices for this line, keyed by affiliate ID (e.g. "19" = DraftKings, "23" = FanDuel). */
  prices: Record<string, TheRundownMarketLinePrice>;
}

export interface TheRundownMarketParticipant {
  id: number;
  type: 'TYPE_TEAM' | 'TYPE_PLAYER' | 'TYPE_RESULT';
  name: string;
  lines: TheRundownMarketLine[];
}

export interface TheRundownMarket {
  /** 1=Moneyline, 2=Spread, 3=Total - see MarketIDsQuery in the API docs for the full catalog. */
  market_id: number;
  name: string;
  participants: TheRundownMarketParticipant[];
}

export interface TheRundownEvent {
  /** Canonical V2 event ID - use this, not event_uuid (a legacy compatibility field). */
  event_id: string;
  sport_id: number;
  event_date: string;
  score?: TheRundownScore;
  teams: TheRundownTeam[];
  markets?: TheRundownMarket[];
}

export interface TheRundownEventsResponse {
  meta: { delta_last_id: string } | null;
  events: TheRundownEvent[];
}

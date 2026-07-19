export interface TheOddsApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export interface TheOddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

export interface TheOddsApiOutcome {
  /** Team name for h2h, or "Over"/"Under" for totals-style markets. */
  name: string;
  price: number;
  /** Line for spreads/totals markets - absent for h2h. */
  point?: number;
}

export interface TheOddsApiMarket {
  /** e.g. "h2h", "spreads", "totals". */
  key: string;
  last_update: string;
  outcomes: TheOddsApiOutcome[];
}

export interface TheOddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: TheOddsApiMarket[];
}

export interface TheOddsApiEventOdds extends TheOddsApiEvent {
  bookmakers: TheOddsApiBookmaker[];
}

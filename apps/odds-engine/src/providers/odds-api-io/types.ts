export type OddsApiIoEventStatus = 'pending' | 'live' | 'settled' | 'cancelled';

export interface OddsApiIoSport {
  name: string;
  slug: string;
}

export interface OddsApiIoLeague {
  name: string;
  slug: string;
}

export interface OddsApiIoEvent {
  id: number;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  date: string;
  status: OddsApiIoEventStatus;
  sport: OddsApiIoSport;
  league: OddsApiIoLeague;
}

/**
 * One row of prices for a market, e.g. { home: "2.40", draw: "2.95", away: "3.45" }
 * or, for a line-based market, { hdp: 2.5, over: "2.02", under: "1.57" }.
 */
export type OddsApiIoOutcome = Record<string, string | number>;

export interface OddsApiIoBookmakerMarket {
  /** Raw market name as reported by the provider, e.g. "ML", "Double Chance", "Totals". */
  name: string;
  updatedAt: string;
  odds: OddsApiIoOutcome[];
}

export interface OddsApiIoOddsResponse {
  id: number;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  date: string;
  status: OddsApiIoEventStatus;
  sport: OddsApiIoSport;
  league: OddsApiIoLeague;
  urls: Record<string, string>;
  bookmakerIds: Record<string, string>;
  bookmakers: Record<string, OddsApiIoBookmakerMarket[]>;
}

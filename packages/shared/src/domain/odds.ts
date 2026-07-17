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
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  isLive: boolean;
  markets: Market[];
}

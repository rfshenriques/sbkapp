export interface ApiSportsTeamRef {
  id: number;
  name: string;
}

export interface ApiSportsFixtureStatus {
  long: string;
  /** e.g. '1H', 'HT', '2H', 'FT', 'NS' */
  short: string;
  elapsed: number | null;
}

export interface ApiSportsFixture {
  id: number;
  date: string;
  status: ApiSportsFixtureStatus;
}

export interface ApiSportsGoals {
  home: number | null;
  away: number | null;
}

export interface ApiSportsFixtureItem {
  fixture: ApiSportsFixture;
  teams: { home: ApiSportsTeamRef; away: ApiSportsTeamRef };
  goals: ApiSportsGoals;
}

/** type is a small fixed set in practice ('Goal' | 'Card' | 'subst' | 'Var'), kept as string since the provider doesn't formally enumerate it. */
export interface ApiSportsEvent {
  time: { elapsed: number; extra: number | null };
  team: ApiSportsTeamRef;
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
}

export interface ApiSportsStatItem {
  type: string;
  value: number | string | null;
}

export interface ApiSportsTeamStatistics {
  team: ApiSportsTeamRef;
  statistics: ApiSportsStatItem[];
}

export interface ApiSportsResponse<T> {
  response: T[];
}

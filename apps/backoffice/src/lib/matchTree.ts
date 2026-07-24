import type { Match } from '@sportsbook/shared';
import { sortSportsByPriority } from './sportPriority';

export interface CompetitionNode {
  competition: string;
  matches: Match[];
}

export interface CountryNode {
  country: string;
  matchCount: number;
  competitions: CompetitionNode[];
}

export interface SportNode {
  sport: string;
  matchCount: number;
  countries: CountryNode[];
}

function byNameAsc<T extends { [key: string]: unknown }>(key: keyof T) {
  return (a: T, b: T) => String(a[key]).localeCompare(String(b[key]));
}

/**
 * Groups live matches into a sport > country > league > match tree for the
 * backoffice trading pages (suspensions, odds overrides, manual markets,
 * boosts) - the same drill-down shape apps/frontend's Sidebar already uses
 * for players, extended one level deeper to reach individual matches.
 * Competitions keep their full match list (not just a count) since every
 * caller needs to render match rows once a league is expanded.
 */
export function buildMatchTree(matches: Match[]): SportNode[] {
  const sportMap = new Map<string, Map<string, Map<string, Match[]>>>();

  for (const match of matches) {
    const countryMap = sportMap.get(match.sport) ?? new Map<string, Map<string, Match[]>>();
    sportMap.set(match.sport, countryMap);

    const competitionMap = countryMap.get(match.country) ?? new Map<string, Match[]>();
    countryMap.set(match.country, competitionMap);

    const competitionMatches = competitionMap.get(match.competition) ?? [];
    competitionMatches.push(match);
    competitionMap.set(match.competition, competitionMatches);
  }

  const sports: SportNode[] = Array.from(sportMap.entries()).map(([sport, countryMap]) => {
    const countries: CountryNode[] = Array.from(countryMap.entries())
      .map(([country, competitionMap]) => {
        const competitions: CompetitionNode[] = Array.from(competitionMap.entries())
          .map(([competition, competitionMatches]) => ({ competition, matches: competitionMatches }))
          .sort(byNameAsc('competition'));
        const matchCount = competitions.reduce((total, node) => total + node.matches.length, 0);
        return { country, matchCount, competitions };
      })
      .sort(byNameAsc('country'));
    const matchCount = countries.reduce((total, node) => total + node.matchCount, 0);
    return { sport, matchCount, countries };
  });

  const orderedSports = sortSportsByPriority(sports.map((node) => node.sport));
  return orderedSports.map((sport) => sports.find((node) => node.sport === sport) as SportNode);
}

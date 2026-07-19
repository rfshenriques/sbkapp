import type { Match } from '@sportsbook/shared';
import { sortSportsByPriority } from '../../lib/sportPriority';

export interface CompetitionNode {
  competition: string;
  matchCount: number;
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
 * Groups matches into a sport > country > competition tree for the sidebar's
 * drill-down menu. Sport order follows the same priority as the homepage's
 * sport chips (sortSportsByPriority); country and competition are
 * alphabetical, since there's no per-player relevance signal yet (see
 * CLAUDE.md / project brief note on quicklinks being a future exploration).
 */
export function buildSportTree(matches: Match[]): SportNode[] {
  const sportMap = new Map<string, Map<string, Map<string, number>>>();

  for (const match of matches) {
    const countryMap = sportMap.get(match.sport) ?? new Map<string, Map<string, number>>();
    sportMap.set(match.sport, countryMap);

    const competitionMap = countryMap.get(match.country) ?? new Map<string, number>();
    countryMap.set(match.country, competitionMap);

    competitionMap.set(match.competition, (competitionMap.get(match.competition) ?? 0) + 1);
  }

  const sports: SportNode[] = Array.from(sportMap.entries()).map(([sport, countryMap]) => {
    const countries: CountryNode[] = Array.from(countryMap.entries())
      .map(([country, competitionMap]) => {
        const competitions: CompetitionNode[] = Array.from(competitionMap.entries())
          .map(([competition, matchCount]) => ({ competition, matchCount }))
          .sort(byNameAsc('competition'));
        const matchCount = competitions.reduce((total, node) => total + node.matchCount, 0);
        return { country, matchCount, competitions };
      })
      .sort(byNameAsc('country'));
    const matchCount = countries.reduce((total, node) => total + node.matchCount, 0);
    return { sport, matchCount, countries };
  });

  const orderedSports = sortSportsByPriority(sports.map((node) => node.sport));
  return orderedSports.map(
    (sport) => sports.find((node) => node.sport === sport) as SportNode,
  );
}

/**
 * competition -> country, resolved from real match data. Used to give the
 * Top Competitions quicklinks a flag even though CompetitionRanking itself
 * only stores a competition name and rank - no country to fabricate one
 * from, so a competition with no live matches just gets no flag.
 */
export function competitionCountryMap(matches: Match[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of matches) {
    if (!map.has(match.competition)) {
      map.set(match.competition, match.country);
    }
  }
  return map;
}

import type { Match } from '@sportsbook/shared';

export interface CompetitionGroup {
  competition: string;
  matches: Match[];
}
export interface SportGroup {
  sport: string;
  competitions: CompetitionGroup[];
}

/** Groups a flat match list into sport > competition, preserving each match's own order within its competition - shared by CampaignMatchesPage and BrowsePage, both of which render "matches from a chosen set of sports/competitions, organized the same way". */
export function groupMatchesBySportAndCompetition(matches: Match[]): SportGroup[] {
  const sportMap = new Map<string, Map<string, Match[]>>();
  for (const match of matches) {
    const competitionMap = sportMap.get(match.sport) ?? new Map<string, Match[]>();
    sportMap.set(match.sport, competitionMap);
    const competitionMatches = competitionMap.get(match.competition) ?? [];
    competitionMatches.push(match);
    competitionMap.set(match.competition, competitionMatches);
  }
  return Array.from(sportMap.entries()).map(([sport, competitionMap]) => ({
    sport,
    competitions: Array.from(competitionMap.entries()).map(([competition, competitionMatches]) => ({
      competition,
      matches: competitionMatches,
    })),
  }));
}

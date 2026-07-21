import type { Match } from '@sportsbook/shared';

/**
 * team name -> country, inferred from the live match feed. TeamColor has no
 * country field of its own (it's just { name, colorHex }), so this is a
 * best-effort grouping key for the admin UI only, not stored anywhere - most
 * teams only ever appear under one country, and a team seen under more than
 * one (e.g. an international qualifier) falls back to whichever country it's
 * been seen under most often.
 */
export function teamCountryMap(matches: Match[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) {
      const perCountry = counts.get(team) ?? new Map<string, number>();
      perCountry.set(match.country, (perCountry.get(match.country) ?? 0) + 1);
      counts.set(team, perCountry);
    }
  }

  const result = new Map<string, string>();
  for (const [team, perCountry] of counts) {
    let bestCountry = '';
    let bestCount = -1;
    for (const [country, count] of perCountry) {
      if (count > bestCount) {
        bestCountry = country;
        bestCount = count;
      }
    }
    result.set(team, bestCountry);
  }
  return result;
}

/**
 * competition -> country, resolved from real match data. Unlike teams, a
 * competition genuinely belongs to one country reliably in this feed, so the
 * first match seen for it is enough (mirrors the frontend's
 * buildSportTree.ts helper of the same name).
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

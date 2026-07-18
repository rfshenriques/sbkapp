import type { ApiSportsFixtureItem } from './types';

/**
 * odds-api.io (our odds/fixture list provider) and api-sports (our live-data
 * provider) are two unrelated vendors with no shared identifier for "the
 * same match" - there's no fixtureId on a Match. This resolves one to the
 * other by team-name matching, which is inherently a heuristic (team names
 * can be spelled differently across providers) rather than a
 * guaranteed-correct join.
 */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Word-token overlap rather than a whole-string substring check, so
 * abbreviated forms match (e.g. "Man City" vs "Manchester City" - "man" is
 * a substring of "manchester", not the other way around, so a plain
 * whole-string .includes() misses this).
 */
function teamNamesMatch(a: string, b: string): boolean {
  const normalizedA = normalizeTeamName(a);
  const normalizedB = normalizeTeamName(b);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;

  const tokensA = normalizedA.split(' ');
  const tokensB = normalizedB.split(' ');
  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];

  return shorter.every((token) =>
    longer.some((otherToken) => otherToken.includes(token) || token.includes(otherToken)),
  );
}

export function findMatchingFixture(
  match: { homeTeam: string; awayTeam: string },
  fixtures: ApiSportsFixtureItem[],
): ApiSportsFixtureItem | undefined {
  return fixtures.find(
    (fixture) =>
      teamNamesMatch(match.homeTeam, fixture.teams.home.name) &&
      teamNamesMatch(match.awayTeam, fixture.teams.away.name),
  );
}

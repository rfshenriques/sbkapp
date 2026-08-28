import type { Match, Market } from '@sportsbook/shared';
import type { EventsService } from './the-odds-api/events-service';

/**
 * Two providers' events are considered "the same real game" if they're the
 * same broad sport, kick off within this window of each other, and the team
 * names line up (see teamsMatch) - deliberately NOT compared by
 * country/competition label, since the two providers' own naming
 * conventions differ (the-odds-api's sport_title for EPL is "EPL",
 * TheRundown's RELEVANT_SPORT_IDS entry here calls it "Premier League") -
 * team names + kickoff time are the only fields both providers describe the
 * same real-world fact with. 15 minutes is generous slack for minor
 * schedule/clock discrepancies between providers; two matches between the
 * same two teams starting further apart than that on the same day doesn't
 * happen in any sport this app covers.
 */
const SAME_GAME_KICKOFF_TOLERANCE_MS = 15 * 60_000;

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Exact match after normalization, or one name containing the other (e.g.
 * "Manchester City" vs "Manchester City FC"). This is deliberately simple,
 * not full fuzzy matching - it does NOT catch a genuine abbreviation like
 * "Man City" vs "Manchester City" (neither string contains the other). If
 * that turns out to cause visible duplicate matches on the board in
 * practice, the real fix is a small team-name crosswalk table (both
 * providers' team_id/name pairs mapped to one canonical name), not a
 * fuzzier string heuristic here.
 */
function teamsMatch(a: string, b: string): boolean {
  const normalizedA = normalizeTeamName(a);
  const normalizedB = normalizeTeamName(b);
  if (normalizedA === normalizedB) return true;
  return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
}

export function isSameGame(a: Match, b: Match): boolean {
  if (a.sport !== b.sport) return false;
  const kickoffDeltaMs = Math.abs(new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  if (kickoffDeltaMs > SAME_GAME_KICKOFF_TOLERANCE_MS) return false;
  return teamsMatch(a.homeTeam, b.homeTeam) && teamsMatch(a.awayTeam, b.awayTeam);
}

function overround(market: Market | undefined): number | undefined {
  if (!market || market.selections.length === 0) return undefined;
  return market.selections.reduce((sum, selection) => sum + 1 / selection.odds, 0);
}

/**
 * Same "one coherent source, never blend" principle as
 * therundown/normalize.ts's own per-market bookmaker choice, one level up:
 * two providers both covering the same game is redundancy, not a reason to
 * mix their prices selection-by-selection into one market. Whichever
 * provider's match-result market has the lower overround (the tighter,
 * more bettor-favorable complete market) wins outright - every market on
 * that Match comes from that one provider, not just match-result.
 */
export function pickBetterMatch(a: Match, b: Match): Match {
  const overroundA = overround(a.markets.find((market) => market.id === 'match-result'));
  const overroundB = overround(b.markets.find((market) => market.id === 'match-result'));

  if (overroundA === undefined) return overroundB === undefined ? a : b;
  if (overroundB === undefined) return a;
  return overroundA <= overroundB ? a : b;
}

/**
 * Merges two providers' match lists into one board: a game covered by only
 * one provider passes through unchanged (this is the redundancy the two
 * providers exist for - one hitting its rate limit or having a bad day
 * doesn't drop that game, the other still has it); a game both providers
 * cover collapses into a single Match via pickBetterMatch rather than
 * appearing twice.
 */
export function mergeMatches(a: Match[], b: Match[]): Match[] {
  const merged: Match[] = [];
  const consumedFromB = new Set<number>();

  for (const matchA of a) {
    const overlapIndex = b.findIndex((matchB, index) => !consumedFromB.has(index) && isSameGame(matchA, matchB));
    if (overlapIndex === -1) {
      merged.push(matchA);
      continue;
    }
    consumedFromB.add(overlapIndex);
    merged.push(pickBetterMatch(matchA, b[overlapIndex]!));
  }

  for (const [index, matchB] of b.entries()) {
    if (!consumedFromB.has(index)) merged.push(matchB);
  }

  return merged;
}

/**
 * Composes two independent EventsService instances (see
 * the-odds-api/events-service.ts and therundown/events-service.ts) into one
 * - server.ts's routes see a single EventsService and don't need to know
 * two providers exist underneath. Each provider's own listMatches() already
 * has its own caching/partial-failure handling; this layer adds none of its
 * own on top - it's a pure per-call merge of whatever each already has
 * cached, so it never delays a genuinely fresh result from either side.
 * A provider whose listMatches() call itself throws (rather than returning
 * [] the way "every sport key failed" already does - see that file's own
 * comment) is treated as empty for this call rather than taking the whole
 * merged board down with it.
 */
export function createMergedEventsService(providers: EventsService[]): EventsService {
  async function listMatches(): Promise<Match[]> {
    const results = await Promise.allSettled(providers.map((provider) => provider.listMatches()));
    const matchLists = results.map((result) => {
      if (result.status === 'fulfilled') return result.value;
      console.error(
        'mergeMatches: a provider\'s listMatches() threw:',
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
      return [];
    });
    return matchLists.reduce((merged, matches) => mergeMatches(merged, matches), [] as Match[]);
  }

  async function getMatchOdds(eventId: string): Promise<Match | undefined> {
    const matches = await listMatches();
    return matches.find((match) => match.id === eventId);
  }

  return { listMatches, getMatchOdds };
}

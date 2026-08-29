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
 * therundown/normalize.ts's own per-market bookmaker choice, one level down:
 * within a single market (e.g. match-result), never mix two providers'
 * prices selection-by-selection - whichever provider's version of that
 * market has the lower overround (the tighter, more bettor-favorable
 * complete market) wins outright for that market only. A market only one
 * provider has (e.g. TheRundown-only handicap/totals) passes through
 * unchanged - this is the actual "aggregate and map so all is one thing
 * only" behaviour, done market-by-market rather than picking one provider's
 * entire match wholesale.
 */
function mergeMarkets(a: Market[], b: Market[]): Market[] {
  const byId = new Map<string, Market>();
  const order: string[] = [];

  for (const market of a) {
    byId.set(market.id, market);
    order.push(market.id);
  }

  for (const market of b) {
    const existing = byId.get(market.id);
    if (!existing) {
      byId.set(market.id, market);
      order.push(market.id);
      continue;
    }
    const existingOverround = overround(existing);
    const candidateOverround = overround(market);
    if (candidateOverround !== undefined && (existingOverround === undefined || candidateOverround < existingOverround)) {
      byId.set(market.id, market);
    }
  }

  return order.map((id) => byId.get(id)!);
}

/**
 * Merges two providers' views of the same real-world game into one Match.
 * Identity fields (id, team names, kickoff, ...) always come from `a` - in
 * practice this is always the-odds-api's match (server.ts merges providers
 * in that order), whose 24h cache barely changes match to match, unlike
 * TheRundown's 5-minute one. Keeping id sourced from the more stable side
 * is what makes a match's id stay resolvable via getMatchOdds() between the
 * board render and a click into it - previously this returned whichever
 * provider's match-result market was tighter *wholesale*, so the exposed id
 * could flip provider (and therefore value) between refreshes, which is
 * what caused "match not found" moments after the match was shown.
 */
export function pickBetterMatch(a: Match, b: Match): Match {
  return { ...a, markets: mergeMarkets(a.markets, b.markets) };
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
  // The most recently computed full merge - see getMatchOdds's third
  // fallback below for why this is kept around.
  let lastKnownMatches: Match[] = [];

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
    const merged = matchLists.reduce((merged, matches) => mergeMatches(merged, matches), [] as Match[]);
    lastKnownMatches = merged;
    return merged;
  }

  /**
   * Three-step lookup, each step catching a different reason a naive
   * "re-merge everything, then find by id" can 404 a match that a moment
   * ago was sitting right there on the board:
   *
   * 1. Ask each provider directly for this exact id. A merged match's id
   *    is always one specific provider's own raw id (see pickBetterMatch -
   *    identity always comes from the first-listed match, whole). Whether
   *    or not that game is *currently* overlapping with the other provider
   *    doesn't matter here - if the provider that originally issued this id
   *    still lists the event under it, this finds it directly, without
   *    caring what the "official" merged identity for that real-world game
   *    happens to be on this particular refresh.
   * 2. Fall back to a fresh full merge, in case neither provider's raw list
   *    contains the id but the merge itself produces it some other way.
   * 3. Fall back to the last full merge this service actually computed. A
   *    match - especially a live one - can legitimately vanish from a
   *    fresh listMatches() for reasons that have nothing to do with id
   *    reassignment (e.g. the-odds-api stops returning odds for an event
   *    once it goes in-play). Serving the last known-good snapshot for one
   *    more lookup keeps a card the user is already looking at resolvable
   *    instead of 404ing the instant an upstream feed's composition shifts.
   */
  async function getMatchOdds(eventId: string): Promise<Match | undefined> {
    for (const provider of providers) {
      const match = await provider.getMatchOdds(eventId);
      if (match) return match;
    }

    // Captured before the listMatches() call below overwrites it.
    const previousKnownMatches = lastKnownMatches;

    const fresh = await listMatches();
    const freshMatch = fresh.find((match) => match.id === eventId);
    if (freshMatch) return freshMatch;

    return previousKnownMatches.find((match) => match.id === eventId);
  }

  return { listMatches, getMatchOdds };
}

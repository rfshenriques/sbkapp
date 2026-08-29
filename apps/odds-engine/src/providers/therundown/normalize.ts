import type { Market, Match, Selection } from '@sportsbook/shared';
import type { TheRundownEvent, TheRundownMarketParticipant } from './types';

/**
 * The soccer competitions + North American leagues we curate from
 * TheRundown, mirroring the-odds-api's RELEVANT_SPORT_KEYS curation (see
 * that file's own comment) - same reasoning: request only what we want
 * rather than every sport TheRundown lists (Politics, PGA, cricket, ...).
 * `sport`/`country` strings are deliberately identical to
 * the-odds-api/normalize.ts's own labels (not TheRundown's raw sport_name)
 * so a match from either provider lands in the same sport/country bucket
 * on the board - see merged-events-service.ts, which relies on this to
 * even consider two matches from different providers as "the same game".
 *
 * Not every the-odds-api competition has a TheRundown equivalent (no
 * Eredivisie, no Boxing in TheRundown's sport list) - those stay
 * the-odds-api-only for now, which is fine: this provider is additive
 * coverage/redundancy, not a 1:1 mirror.
 */
export const RELEVANT_SPORT_IDS: Array<{ id: number; sport: string; country: string; competition: string }> = [
  { id: 11, sport: 'Football', country: 'England', competition: 'Premier League' },
  { id: 14, sport: 'Football', country: 'Spain', competition: 'La Liga' },
  { id: 13, sport: 'Football', country: 'Germany', competition: 'Bundesliga' },
  { id: 15, sport: 'Football', country: 'Italy', competition: 'Serie A' },
  { id: 12, sport: 'Football', country: 'France', competition: 'Ligue 1' },
  { id: 16, sport: 'Football', country: 'Europe', competition: 'UEFA Champions League' },
  { id: 18, sport: 'Football', country: 'World', competition: 'FIFA World Cup' },
  { id: 6, sport: 'Ice Hockey', country: 'USA', competition: 'NHL' },
  { id: 2, sport: 'American Football', country: 'USA', competition: 'NFL' },
  { id: 7, sport: 'MMA', country: 'International', competition: 'UFC/MMA' },
];

const SPORT_META_BY_ID = new Map(RELEVANT_SPORT_IDS.map((entry) => [entry.id, entry]));

/**
 * 1=Moneyline, 2=Handicap/Spread, 3=Totals - the only market IDs
 * toMatchResultSelections/toHandicapSelections/toTotalsSelections below
 * actually read off a TheRundownEvent. Passed to the client's
 * getEventsBySportAndDate so the request itself is scoped to these -
 * asking for TheRundown's full default market set per event (player
 * props, team totals, alternate lines, live period variants, every
 * affiliate, ...) costs "data points" against the free tier's separate
 * 20k/day cap even though none of that extra data is ever used.
 */
export const PARSED_MARKET_IDS = '1,2,3';

/** Off-the-board sentinel per TheRundown's docs - pricing temporarily pulled, not a real price. */
const OFF_BOARD_PRICE = 0.0001;

/** American odds -> decimal, e.g. +150 -> 2.50, -170 -> 1.588. */
export function americanToDecimal(americanOdds: number): number {
  return americanOdds > 0 ? 1 + americanOdds / 100 : 1 + 100 / Math.abs(americanOdds);
}

interface ClassifiedParticipant {
  participant: TheRundownMarketParticipant;
  id: string;
  name: string;
}

/** Home/Away by cross-referencing the event's own team_id/is_home - works for moneyline and handicap alike (both carry only TYPE_TEAM participants, moneyline additionally carries the draw below). */
function classifyTeamParticipant(event: TheRundownEvent, participant: TheRundownMarketParticipant): ClassifiedParticipant {
  const homeTeamId = event.teams.find((team) => team.is_home)?.team_id;
  const isHome = participant.id === homeTeamId;
  return { participant, id: isHome ? 'home' : 'away', name: isHome ? 'Home' : 'Away' };
}

function classifyMoneylineParticipant(event: TheRundownEvent, participant: TheRundownMarketParticipant): ClassifiedParticipant {
  if (participant.type === 'TYPE_TEAM') return classifyTeamParticipant(event, participant);
  // Only a soccer moneyline carries a TYPE_RESULT participant (the draw) -
  // the North American leagues in RELEVANT_SPORT_IDS never do.
  return { participant, id: 'draw', name: 'Draw' };
}

function classifyTotalsParticipant(participant: TheRundownMarketParticipant): ClassifiedParticipant {
  // TYPE_RESULT "Over"/"Under" - the participant's own `name` already says
  // which, no event cross-reference needed (unlike moneyline/handicap).
  const isOver = participant.name.toLowerCase() === 'over';
  return { participant, id: isOver ? 'over' : 'under', name: isOver ? 'Over' : 'Under' };
}

/** One (affiliate, selection)'s winning price - the line value travels with it since handicap/totals need it in the displayed name (e.g. "+1.5", "224.5"), unlike moneyline where every line's value is always empty. */
interface PricedSelection {
  decimal: number;
  lineValue: string;
}

/**
 * Prices the whole market from ONE affiliate/sportsbook rather than mixing
 * the best price per selection across many - blending books selection by
 * selection can produce an internally inconsistent market (Book A's home
 * price, Book B's away price, and Book C's draw price were never meant to
 * sit together; they reflect three different books' own independent risk
 * models). Instead: among every affiliate that prices *every* selection in
 * this market at its main line, pick the one with the lowest overround
 * (sum of 1/decimal-odds across its own selections) - the tightest, most
 * bettor-favorable *complete* market available from a single coherent
 * source - and use that affiliate's own prices throughout. The 0.0001
 * "off the board" sentinel is excluded; a book with pricing pulled isn't a
 * real quote to consider. Returns undefined when no affiliate prices every
 * selection (the market isn't usable from any single coherent source).
 */
function bestAffiliatePricing(classified: ClassifiedParticipant[]): Map<string, PricedSelection> | undefined {
  const byAffiliate = new Map<string, Map<string, PricedSelection>>();
  for (const { participant, id: selectionId } of classified) {
    for (const line of participant.lines) {
      for (const [affiliateId, price] of Object.entries(line.prices)) {
        if (!price.is_main_line || price.price === OFF_BOARD_PRICE) continue;
        let bySelection = byAffiliate.get(affiliateId);
        if (!bySelection) {
          bySelection = new Map();
          byAffiliate.set(affiliateId, bySelection);
        }
        const decimal = americanToDecimal(price.price);
        // Defensive: keep the best if the same affiliate+selection somehow
        // appears more than once (shouldn't happen for a single main line).
        const existing = bySelection.get(selectionId);
        if (existing === undefined || decimal > existing.decimal) {
          bySelection.set(selectionId, { decimal, lineValue: line.value });
        }
      }
    }
  }

  const expectedSelectionCount = new Set(classified.map((entry) => entry.id)).size;
  let bestAffiliateId: string | undefined;
  let bestOverround = Infinity;
  for (const [affiliateId, prices] of byAffiliate) {
    if (prices.size !== expectedSelectionCount) continue; // only a book pricing the whole market is a candidate
    const overround = [...prices.values()].reduce((sum, { decimal }) => sum + 1 / decimal, 0);
    if (overround < bestOverround) {
      bestOverround = overround;
      bestAffiliateId = affiliateId;
    }
  }
  return bestAffiliateId ? byAffiliate.get(bestAffiliateId) : undefined;
}

function toMatchResultSelections(event: TheRundownEvent, participants: TheRundownMarketParticipant[]): Selection[] {
  const classified = participants.map((participant) => classifyMoneylineParticipant(event, participant));
  const winning = bestAffiliatePricing(classified);
  if (!winning) return [];
  return classified.map(({ id, name }) => ({ id, name, odds: winning.get(id)!.decimal }));
}

/**
 * Renders a spread value with an explicit "+" for positive lines. A real
 * response we checked already sends the sign itself (e.g. "+1.5", "-1.5"),
 * but that's not guaranteed for every sport/market - only prepend one when
 * the raw string doesn't already carry it.
 */
function formatSpread(lineValue: string): string {
  if (lineValue.startsWith('+') || lineValue.startsWith('-')) return lineValue;
  const numeric = Number(lineValue);
  if (!Number.isFinite(numeric)) return lineValue;
  return numeric > 0 ? `+${lineValue}` : lineValue;
}

/**
 * The real team name (not the generic "Home"/"Away" match-result uses) is
 * baked directly into the selection name here, since there's no existing
 * frontend caption-substitution for handicap/totals the way MarketSelections'
 * captionFor already does for match-result's exact "home"/"away"/"draw"
 * labels - a suffixed name like "Home +1.5" wouldn't match that check
 * anyway. If a future frontend pass adds a dedicated line-value affordance,
 * this can go back to the generic label plus a separate field then.
 */
function toHandicapSelections(event: TheRundownEvent, participants: TheRundownMarketParticipant[]): Selection[] {
  const classified = participants.map((participant) => classifyTeamParticipant(event, participant));
  const winning = bestAffiliatePricing(classified);
  if (!winning) return [];

  const homeTeam = event.teams.find((team) => team.is_home);
  const awayTeam = event.teams.find((team) => team.is_away);
  return classified.map(({ id }) => {
    const { decimal, lineValue } = winning.get(id)!;
    const team = id === 'home' ? homeTeam : awayTeam;
    const teamName = team ? `${team.name} ${team.mascot}`.trim() : id === 'home' ? 'Home' : 'Away';
    return { id, name: `${teamName} ${formatSpread(lineValue)}`, odds: decimal };
  });
}

function toTotalsSelections(participants: TheRundownMarketParticipant[]): Selection[] {
  const classified = participants.map((participant) => classifyTotalsParticipant(participant));
  const winning = bestAffiliatePricing(classified);
  if (!winning) return [];
  return classified.map(({ id, name }) => {
    const { decimal, lineValue } = winning.get(id)!;
    return { id, name: `${name} ${lineValue}`, odds: decimal };
  });
}

/**
 * TheRundown reports real event status (unlike the-odds-api's odds
 * endpoint, which has none - see the-odds-api/normalize.ts's isLikelyLive
 * heuristic) so live state here is an actual fact from the feed, not a
 * kickoff-time guess.
 */
function isLiveStatus(eventStatus: string | undefined): boolean {
  if (!eventStatus) return false;
  return !['STATUS_SCHEDULED', 'STATUS_FINAL', 'STATUS_POSTPONED', 'STATUS_CANCELED'].includes(eventStatus);
}

/**
 * Maps one TheRundown v2 event to our internal Match/Market/Selection shape.
 * Full-game, main-line only for moneyline (1), handicap/spread (2), and
 * totals (3) - period markets (1st half, quarters, ...) and live in-play
 * variants exist in the raw feed too but aren't mapped here; add them once
 * there's a frontend concept of "which period" to attach them to. Market
 * ids ('match-result'/'handicap'/'total-goals') deliberately match the
 * prefixes apps/frontend/src/lib/marketCategory.ts already routes into the
 * Main/Handicaps/Totals tabs.
 */
export function normalizeTheRundownEvent(raw: TheRundownEvent): Match | undefined {
  const meta = SPORT_META_BY_ID.get(raw.sport_id);
  if (!meta) return undefined;

  const homeTeam = raw.teams.find((team) => team.is_home);
  const awayTeam = raw.teams.find((team) => team.is_away);
  if (!homeTeam || !awayTeam) return undefined;

  const markets: Market[] = [];

  const moneyline = raw.markets?.find((market) => market.market_id === 1);
  if (moneyline) {
    const selections = toMatchResultSelections(raw, moneyline.participants);
    if (selections.length > 0) markets.push({ id: 'match-result', name: 'Match Result', selections });
  }

  const handicap = raw.markets?.find((market) => market.market_id === 2);
  if (handicap) {
    const selections = toHandicapSelections(raw, handicap.participants);
    if (selections.length > 0) markets.push({ id: 'handicap', name: 'Handicap', selections });
  }

  const totals = raw.markets?.find((market) => market.market_id === 3);
  if (totals) {
    const selections = toTotalsSelections(totals.participants);
    if (selections.length > 0) {
      markets.push({
        id: 'total-goals',
        name: meta.sport === 'Football' ? 'Total Goals' : 'Totals',
        selections,
      });
    }
  }

  return {
    id: `therundown:${raw.event_id}`,
    sport: meta.sport,
    country: meta.country,
    competition: meta.competition,
    homeTeam: `${homeTeam.name} ${homeTeam.mascot}`.trim(),
    awayTeam: `${awayTeam.name} ${awayTeam.mascot}`.trim(),
    kickoff: raw.event_date,
    isLive: isLiveStatus(raw.score?.event_status),
    markets,
  };
}

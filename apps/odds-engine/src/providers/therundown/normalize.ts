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

/** Off-the-board sentinel per TheRundown's docs - pricing temporarily pulled, not a real price. */
const OFF_BOARD_PRICE = 0.0001;

/** American odds -> decimal, e.g. +150 -> 2.50, -170 -> 1.588. */
export function americanToDecimal(americanOdds: number): number {
  return americanOdds > 0 ? 1 + americanOdds / 100 : 1 + 100 / Math.abs(americanOdds);
}

function classifySelection(
  event: TheRundownEvent,
  participant: TheRundownMarketParticipant,
): { id: string; name: string } {
  if (participant.type === 'TYPE_TEAM') {
    const homeTeamId = event.teams.find((team) => team.is_home)?.team_id;
    const isHome = participant.id === homeTeamId;
    return isHome ? { id: 'home', name: 'Home' } : { id: 'away', name: 'Away' };
  }
  // Only a soccer moneyline carries a TYPE_RESULT participant (the draw) -
  // the North American leagues in RELEVANT_SPORT_IDS never do.
  return { id: 'draw', name: 'Draw' };
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
 * real quote to consider.
 */
function toMatchResultSelections(event: TheRundownEvent, participants: TheRundownMarketParticipant[]): Selection[] {
  const classified = participants.map((participant) => ({ participant, ...classifySelection(event, participant) }));

  const decimalOddsByAffiliate = new Map<string, Map<string, number>>();
  for (const { participant, id: selectionId } of classified) {
    for (const line of participant.lines) {
      for (const [affiliateId, price] of Object.entries(line.prices)) {
        if (!price.is_main_line || price.price === OFF_BOARD_PRICE) continue;
        let bySelection = decimalOddsByAffiliate.get(affiliateId);
        if (!bySelection) {
          bySelection = new Map();
          decimalOddsByAffiliate.set(affiliateId, bySelection);
        }
        const decimal = americanToDecimal(price.price);
        // Defensive: keep the best if the same affiliate+selection somehow
        // appears more than once (shouldn't happen for a single main line).
        const existing = bySelection.get(selectionId);
        if (existing === undefined || decimal > existing) bySelection.set(selectionId, decimal);
      }
    }
  }

  const expectedSelectionCount = new Set(classified.map((entry) => entry.id)).size;
  let bestAffiliateId: string | undefined;
  let bestOverround = Infinity;
  for (const [affiliateId, prices] of decimalOddsByAffiliate) {
    if (prices.size !== expectedSelectionCount) continue; // only a book pricing the whole market is a candidate
    const overround = [...prices.values()].reduce((sum, decimal) => sum + 1 / decimal, 0);
    if (overround < bestOverround) {
      bestOverround = overround;
      bestAffiliateId = affiliateId;
    }
  }
  if (!bestAffiliateId) return [];

  const winningPrices = decimalOddsByAffiliate.get(bestAffiliateId)!;
  return classified.map(({ id, name }) => ({ id, name, odds: winningPrices.get(id)! }));
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
 * Only the moneyline (market_id 1) is mapped for now - handicap/totals
 * markets exist in the raw feed (see types.ts) but need a "which alternate
 * line is the one to show" decision the app doesn't have UI for yet
 * (MarketSelections shows one market row, not a line picker); add them once
 * that's designed rather than guessing at a single alt line here.
 */
export function normalizeTheRundownEvent(raw: TheRundownEvent): Match | undefined {
  const meta = SPORT_META_BY_ID.get(raw.sport_id);
  if (!meta) return undefined;

  const homeTeam = raw.teams.find((team) => team.is_home);
  const awayTeam = raw.teams.find((team) => team.is_away);
  if (!homeTeam || !awayTeam) return undefined;

  const moneyline = raw.markets?.find((market) => market.market_id === 1);
  const markets: Market[] = moneyline
    ? [
        {
          id: 'match-result',
          name: 'Match Result',
          selections: toMatchResultSelections(raw, moneyline.participants),
        },
      ]
    : [];

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

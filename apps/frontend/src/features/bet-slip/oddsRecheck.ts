import { getMatchById } from '../../lib/backendApi';
import type { BetSlipSelection } from './betSlipStore';

export interface OddsRecheckChange {
  selection: BetSlipSelection;
  newOdds: number;
}

/**
 * The very last thing that runs before POSTing a bet, not a background poll
 * (see useMarketSuspensions for that pattern) - fetches the current price
 * for every unique match referenced by `selections` in parallel and compares
 * it against what the player saw when they added each one to the slip.
 * A selection whose market/price can no longer be found (suspended, removed)
 * is left alone here - that's still enforced server-side inside PamService's
 * placement transaction and surfaces as its own separate error, this check
 * is only about a price that moved.
 */
export async function findOddsChanges(
  brandId: string,
  selections: BetSlipSelection[],
): Promise<OddsRecheckChange[]> {
  const uniqueMatchIds = Array.from(new Set(selections.map((selection) => selection.matchId)));
  const matches = await Promise.all(uniqueMatchIds.map((matchId) => getMatchById(brandId, matchId)));
  const matchById = new Map(uniqueMatchIds.map((matchId, index) => [matchId, matches[index]]));

  const changes: OddsRecheckChange[] = [];
  for (const selection of selections) {
    const currentOdds = matchById
      .get(selection.matchId)
      ?.markets.find((market) => market.id === selection.marketId)
      ?.selections.find((current) => current.id === selection.selectionId)?.odds;
    if (currentOdds !== undefined && currentOdds !== selection.odds) {
      changes.push({ selection, newOdds: currentOdds });
    }
  }
  return changes;
}

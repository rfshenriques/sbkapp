export interface SharedBetSelectionRef {
  matchId: string;
  marketId: string;
  selectionId: string;
}

const FIELD_SEP = '~';
const ITEM_SEP = ',';

export function encodeSharedBetSelections(selections: SharedBetSelectionRef[]): string {
  return selections.map((ref) => `${ref.matchId}${FIELD_SEP}${ref.marketId}${FIELD_SEP}${ref.selectionId}`).join(ITEM_SEP);
}

/** Never throws - a malformed/tampered link just resolves to null, handled as "invalid link" by SharedBetPage. */
export function decodeSharedBetSelections(raw: string): SharedBetSelectionRef[] | null {
  if (!raw) {
    return null;
  }
  const refs: SharedBetSelectionRef[] = [];
  for (const item of raw.split(ITEM_SEP)) {
    const [matchId, marketId, selectionId] = item.split(FIELD_SEP);
    if (!matchId || !marketId || !selectionId) {
      return null;
    }
    refs.push({ matchId, marketId, selectionId });
  }
  return refs.length > 0 ? refs : null;
}

/**
 * Deep link that, once opened, resolves these selections against *today's*
 * live match data and adds them to the visiting player's own bet slip (see
 * SharedBetPage) - never the odds/availability frozen on the original bet,
 * since a copied bet should reflect today's market, not a stale snapshot.
 * Only ever carries match/market/selection identifiers, nothing about the
 * original bettor or their stake.
 */
export function buildSharedBetUrl(selections: SharedBetSelectionRef[]): string {
  const param = encodeSharedBetSelections(selections);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/shared-bet?sel=${encodeURIComponent(param)}`;
}

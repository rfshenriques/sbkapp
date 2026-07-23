/**
 * Client-side mirror of the backend's BoostService/odds-ladder.ts price
 * climb - used only to preview what a boost will resolve to while a trader
 * is setting it up. The backend is the source of truth at bet-serving time
 * (it climbs from whatever price margin/manual-markets/overrides produce,
 * not the raw feed price this preview uses), so this is a UI convenience,
 * not the authoritative calculation.
 */
export function previewBoostedPrice(ladder: number[], basePrice: number, ticks: number): number | null {
  if (ladder.length === 0) {
    return null;
  }
  let nearestIndex = 0;
  let nearestDiff = Infinity;
  for (let i = 0; i < ladder.length; i += 1) {
    const diff = Math.abs(ladder[i]! - basePrice);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestIndex = i;
    }
  }
  const targetIndex = Math.min(ladder.length - 1, nearestIndex + ticks);
  return ladder[targetIndex]!;
}

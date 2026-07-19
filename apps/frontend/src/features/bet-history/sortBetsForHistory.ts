import type { PlacedBet } from '../../lib/backendApi';

/** Open (PENDING) bets first, then everything else by most recent. Within each group, most recent first. */
export function sortBetsForHistory(bets: PlacedBet[]): PlacedBet[] {
  return [...bets].sort((a, b) => {
    const aOpen = a.status === 'PENDING';
    const bOpen = b.status === 'PENDING';
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

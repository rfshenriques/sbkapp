/** These three, in this order, always lead sport listings when present; everything else follows in the order it was first seen. */
export const PRIORITY_SPORT_ORDER = ['Football', 'Tennis', 'Basketball'];

export function sortSportsByPriority(sports: string[]): string[] {
  return [...sports].sort((a, b) => {
    const rankA = PRIORITY_SPORT_ORDER.indexOf(a);
    const rankB = PRIORITY_SPORT_ORDER.indexOf(b);
    const normalizedA = rankA === -1 ? PRIORITY_SPORT_ORDER.length : rankA;
    const normalizedB = rankB === -1 ? PRIORITY_SPORT_ORDER.length : rankB;
    return normalizedA - normalizedB;
  });
}

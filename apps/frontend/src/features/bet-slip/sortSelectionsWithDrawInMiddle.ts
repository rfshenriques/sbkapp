import type { Selection } from '@sportsbook/shared';

/**
 * Display rule: a "Draw" selection (case-insensitive) always renders in the
 * middle position, regardless of the order the API returns selections in.
 * Selections with no draw are left in their original order.
 */
export function sortSelectionsWithDrawInMiddle(selections: Selection[]): Selection[] {
  const drawIndex = selections.findIndex((selection) => selection.name.toLowerCase() === 'draw');
  if (drawIndex === -1) return selections;

  const draw = selections[drawIndex] as Selection;
  const others = selections.filter((_, index) => index !== drawIndex);
  const middle = Math.floor(others.length / 2);

  return [...others.slice(0, middle), draw, ...others.slice(middle)];
}

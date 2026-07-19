import type { Selection } from '@sportsbook/shared';

/**
 * Display rule for a match-result market: Home always renders first, Away
 * always last, and Draw (when present) always in between - regardless of
 * the order the API returns selections in. This keeps the Home odds on the
 * same side as the Home team name everywhere (both are always "first"), and
 * keeps a draw centered rather than wherever it happened to sort.
 *
 * Only reorders when both a "Home" and an "Away" selection are recognizable
 * (case-insensitive) - any other market (BTTS, over/under, correct score,
 * etc.) is left in its original order rather than guessing at one.
 */
export function sortMatchResultSelections(selections: Selection[]): Selection[] {
  const home = selections.find((selection) => selection.name.toLowerCase() === 'home');
  const away = selections.find((selection) => selection.name.toLowerCase() === 'away');
  if (!home || !away) return selections;

  const draw = selections.find((selection) => selection.name.toLowerCase() === 'draw');
  return draw ? [home, draw, away] : [home, away];
}

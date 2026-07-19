/**
 * Sport -> emoji icon, keyed to the human-readable labels odds-engine's
 * normalizer actually produces (SPORT_LABEL_BY_KEY_PREFIX in
 * apps/odds-engine/src/providers/the-odds-api/normalize.ts), plus Tennis/
 * Basketball since sortSportsByPriority already anticipates them. No icon
 * library dependency - a small emoji map keeps this self-contained and
 * theme-proof (renders identically in light/dark, no asset to color-match).
 */
const SPORT_ICON: Record<string, string> = {
  Football: '⚽',
  Tennis: '🎾',
  Basketball: '🏀',
  'Ice Hockey': '🏒',
  'American Football': '🏈',
  MMA: '🥋',
  Boxing: '🥊',
};

const DEFAULT_SPORT_ICON = '🏆';

export function sportIcon(sport: string): string {
  return SPORT_ICON[sport] ?? DEFAULT_SPORT_ICON;
}

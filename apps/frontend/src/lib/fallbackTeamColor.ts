/**
 * A stand-in accent color for a team badge when no admin has assigned that
 * team a real one yet (see the backoffice Team Colors page) - without this,
 * the two-color team layout only ever appeared for the handful of teams
 * someone had gotten around to coloring, and looked broken everywhere else.
 * Deterministic per team name (same team always gets the same color),
 * picked from a fixed brand-neutral palette rather than anything resembling
 * a real club color. Shared by every place a team color renders (match
 * cards, the match detail header, ...) so the same team gets the same
 * fallback color everywhere, not just wherever this was first wired up.
 */
const FALLBACK_TEAM_COLORS = [
  '#F87171',
  '#FB923C',
  '#FBBF24',
  '#4ADE80',
  '#2DD4BF',
  '#38BDF8',
  '#818CF8',
  '#C084FC',
  '#F472B6',
];

export function fallbackTeamColor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return FALLBACK_TEAM_COLORS[hash % FALLBACK_TEAM_COLORS.length]!;
}

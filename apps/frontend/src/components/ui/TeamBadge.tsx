/** "Real Madrid" -> "REA", "Chelsea" -> "CHE" - a 3-letter badge fallback for a team with no admin-assigned acronym yet (see Team Colors backoffice). */
export function fallbackAcronym(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0]!.slice(0, 3).toUpperCase();
  if (words.length === 2) return (words[0]![0]! + words[1]!.slice(0, 2)).toUpperCase();
  return (words[0]![0]! + words[1]![0]! + words[2]![0]!).toUpperCase();
}

interface TeamBadgeProps {
  name: string;
  colorHex: string;
  acronym?: string;
  className?: string;
}

/**
 * Circular team badge - fills with the team's admin-assigned color (see
 * Team Colors backoffice) when there is one, a deterministic per-team
 * fallback color otherwise. The 3-letter acronym itself (same backoffice
 * page, falling back to fallbackAcronym above when unset) renders larger
 * than the circle and slightly overflows its edge rather than being
 * clipped to fit inside it - a layered text-shadow fakes the letters
 * standing up off the badge instead of sitting flat on it (see
 * .team-acronym in index.css).
 */
export function TeamBadge({ name, colorHex, acronym, className = 'h-6 w-6 sm:h-7 sm:w-7' }: TeamBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ backgroundColor: colorHex }}
    >
      <span className="team-acronym">{acronym ?? fallbackAcronym(name)}</span>
    </span>
  );
}

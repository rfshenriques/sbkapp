const STEP_MS = 40;
const MAX_INDEX = 8;

/** animation-delay for the nth item in a list using .fade-in-up, capped so long lists don't take forever to finish appearing. */
export function staggerDelay(index: number): { animationDelay: string } {
  return { animationDelay: `${Math.min(index, MAX_INDEX) * STEP_MS}ms` };
}

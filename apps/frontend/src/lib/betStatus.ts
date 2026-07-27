import type { BetStatus, SelectionStatus } from './backendApi';

/**
 * Shared WON/LOST/VOID/PENDING(OPEN) color treatment - bet history and the
 * bet slip's own selection rows both need a status indicator, and both
 * should read the same way rather than inventing a one-off palette per
 * screen. WON/LOST reuse the fixed (non-brand) price-up/price-down tokens
 * already used for odds-flash and LIVE badges; PENDING/OPEN is neutral grey
 * (still resolving, nothing to call out yet); VOID is a light tint of
 * --color-highlight (the general accent token) - it's the one status worth
 * a bit of color since it's an unusual outcome, but light rather than the
 * solid fill a real win/loss gets.
 */
const STATUS_KEY: Record<BetStatus | SelectionStatus, 'pending' | 'won' | 'lost' | 'void'> = {
  PENDING: 'pending',
  OPEN: 'pending',
  WON: 'won',
  LOST: 'lost',
  VOID: 'void',
};

const BADGE_CLASSES: Record<'pending' | 'won' | 'lost' | 'void', string> = {
  pending: 'bg-surface-2 text-text-secondary',
  won: 'bg-price-up text-black',
  lost: 'bg-price-down text-white',
  void: 'bg-highlight/20 text-highlight',
};

const TEXT_CLASSES: Record<'pending' | 'won' | 'lost' | 'void', string> = {
  pending: 'text-text-secondary',
  won: 'text-price-up',
  lost: 'text-price-down',
  void: 'text-highlight',
};

/** Display label - PENDING reads as "OPEN" to the player, everything else is shown as-is. */
const DISPLAY_LABEL: Record<'pending' | 'won' | 'lost' | 'void', string> = {
  pending: 'OPEN',
  won: 'WON',
  lost: 'LOST',
  void: 'VOID',
};

export type BetStatusCategory = 'pending' | 'won' | 'lost' | 'void' | 'insured';

/**
 * A LOST bet that was insured (bet.insuranceCostPercent > 0 - see
 * PamService.settleSelection's INSURANCE_BET grant) isn't a real loss to the
 * player - the stake comes back as a freebet - so it gets its own category
 * (the fixed --color-insured treatment) instead of reading as a plain
 * price-down loss. Only ever applies at bet level (insurance is a
 * whole-bet opt-in, never per-selection), so callers pass `insured` only
 * for a bet's own status, not an individual leg's. The single source of
 * truth for every other status->color mapping in this file, including the
 * canvas-based share image (see shareBetImage.ts), which can't use Tailwind
 * classes and needs the raw color instead.
 */
export function betStatusCategory(status: BetStatus | SelectionStatus, insured = false): BetStatusCategory {
  if (insured && STATUS_KEY[status] === 'lost') {
    return 'insured';
  }
  return STATUS_KEY[status];
}

const INSURED_BADGE_CLASSES = 'bg-insured/20 text-insured';
const INSURED_TEXT_CLASSES = 'text-insured';

export function betStatusBadgeClasses(status: BetStatus | SelectionStatus, insured = false): string {
  const category = betStatusCategory(status, insured);
  return category === 'insured' ? INSURED_BADGE_CLASSES : BADGE_CLASSES[category];
}

export function betStatusTextClasses(status: BetStatus | SelectionStatus, insured = false): string {
  const category = betStatusCategory(status, insured);
  return category === 'insured' ? INSURED_TEXT_CLASSES : TEXT_CLASSES[category];
}

export function betStatusLabel(status: BetStatus | SelectionStatus): string {
  return DISPLAY_LABEL[STATUS_KEY[status]];
}

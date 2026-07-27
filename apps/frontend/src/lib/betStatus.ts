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

/**
 * A LOST bet that was insured (bet.insuranceCostPercent > 0 - see
 * PamService.settleSelection's INSURANCE_BET grant) isn't a real loss to the
 * player - the stake comes back as a freebet - so it gets the fixed
 * --color-insured treatment instead of reading as a plain price-down loss.
 * Only ever applies at bet level (insurance is a whole-bet opt-in, never
 * per-selection), so callers pass `insured` only for a bet's own status, not
 * an individual leg's.
 */
export function betStatusBadgeClasses(status: BetStatus | SelectionStatus, insured = false): string {
  if (insured && STATUS_KEY[status] === 'lost') {
    return 'bg-insured/20 text-insured';
  }
  return BADGE_CLASSES[STATUS_KEY[status]];
}

export function betStatusTextClasses(status: BetStatus | SelectionStatus, insured = false): string {
  if (insured && STATUS_KEY[status] === 'lost') {
    return 'text-insured';
  }
  return TEXT_CLASSES[STATUS_KEY[status]];
}

export function betStatusLabel(status: BetStatus | SelectionStatus): string {
  return DISPLAY_LABEL[STATUS_KEY[status]];
}

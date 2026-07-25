import type { BetStatus, SelectionStatus } from './backendApi';

/**
 * Shared WON/LOST/VOID/PENDING(OPEN) color treatment - bet history and the
 * bet slip's own selection rows both need a status indicator, and both
 * should read the same way rather than inventing a one-off palette per
 * screen. WON/LOST reuse the fixed (non-brand) price-up/price-down tokens
 * already used for odds-flash and LIVE badges; PENDING/OPEN reuses
 * --color-highlight (the general accent token); VOID is neutral.
 */
const STATUS_KEY: Record<BetStatus | SelectionStatus, 'pending' | 'won' | 'lost' | 'void'> = {
  PENDING: 'pending',
  OPEN: 'pending',
  WON: 'won',
  LOST: 'lost',
  VOID: 'void',
};

const BADGE_CLASSES: Record<'pending' | 'won' | 'lost' | 'void', string> = {
  pending: 'bg-highlight text-black',
  won: 'bg-price-up text-black',
  lost: 'bg-price-down text-white',
  void: 'bg-surface-2 text-text-secondary',
};

const TEXT_CLASSES: Record<'pending' | 'won' | 'lost' | 'void', string> = {
  pending: 'text-highlight',
  won: 'text-price-up',
  lost: 'text-price-down',
  void: 'text-text-muted',
};

export function betStatusBadgeClasses(status: BetStatus | SelectionStatus): string {
  return BADGE_CLASSES[STATUS_KEY[status]];
}

export function betStatusTextClasses(status: BetStatus | SelectionStatus): string {
  return TEXT_CLASSES[STATUS_KEY[status]];
}

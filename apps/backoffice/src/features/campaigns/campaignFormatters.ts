import type { AudienceMode } from '../../lib/backendApi';

export function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function displayToCents(value: string): number {
  return Math.round(Number(value) * 100);
}

export function audienceLabel(mode: AudienceMode): string {
  switch (mode) {
    case 'ALL':
      return 'Everyone';
    case 'LOGGED_OUT':
      return 'Logged-out players only';
    case 'LOGGED_IN':
      return 'Logged-in players only';
    case 'SEGMENTS':
      return 'Specific player segments';
  }
}

export const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'LOGGED_OUT', 'LOGGED_IN', 'SEGMENTS'];

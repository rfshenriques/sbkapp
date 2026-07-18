import type { LiveMatchMomentum, LiveMatchStat } from '@sportsbook/shared';

const NEUTRAL_MOMENTUM: LiveMatchMomentum = { home: 50, away: 50 };

/**
 * api-sports (like every provider we've checked) doesn't expose "momentum"
 * as a field - it's derived here from recent attacking activity between two
 * consecutive polls, not the whole match. Total Shots and Corner Kicks are
 * cumulative counters in the raw stats, so the *delta* since the last poll
 * approximates "who's been pressing lately," which is what a momentum bar
 * is meant to show. Falls back to the previous value (or a neutral 50/50
 * on the very first poll) when there's been no attacking activity to
 * measure since the last poll, rather than snapping to an arbitrary split.
 */
export function computeMomentum(
  previousStats: LiveMatchStat[] | undefined,
  currentStats: LiveMatchStat[],
  previousMomentum: LiveMatchMomentum = NEUTRAL_MOMENTUM,
): LiveMatchMomentum {
  const previousActivity = extractActivity(previousStats);
  const currentActivity = extractActivity(currentStats);

  if (!previousActivity || !currentActivity) {
    return NEUTRAL_MOMENTUM;
  }

  const homeDelta = Math.max(0, currentActivity.home - previousActivity.home);
  const awayDelta = Math.max(0, currentActivity.away - previousActivity.away);
  const total = homeDelta + awayDelta;

  if (total === 0) {
    return previousMomentum;
  }

  const home = Math.round((homeDelta / total) * 100);
  return { home, away: 100 - home };
}

function extractActivity(
  stats: LiveMatchStat[] | undefined,
): { home: number; away: number } | undefined {
  if (!stats) return undefined;

  const shots = stats.find((stat) => stat.type === 'Total Shots');
  const corners = stats.find((stat) => stat.type === 'Corner Kicks');
  if (!shots && !corners) return undefined;

  return {
    home: toNumber(shots?.home) + toNumber(corners?.home) * 1.5,
    away: toNumber(shots?.away) + toNumber(corners?.away) * 1.5,
  };
}

function toNumber(value: number | string | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseFloat(value) || 0;
  return 0;
}

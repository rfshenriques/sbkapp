export interface LeaderboardPointsRules {
  pointsPerEuroStaked: number;
  useCombinedOddsAsMultiplier: boolean;
}

export interface LeaderboardQualifyingBet {
  stakeCents: number;
  /** Product of every non-VOID leg's odds - the bet's own effective combined price at the moment points are calculated. */
  effectiveCombinedOdds: number;
}

/**
 * points = (stakeCents / 100) * pointsPerEuroStaked, optionally further
 * multiplied by the bet's own effective combined odds - staff-configured
 * per campaign (see LeaderboardCampaign.pointsPerEuroStaked/
 * useCombinedOddsAsMultiplier). Rounded to a whole point.
 */
export function calculateLeaderboardPoints(rules: LeaderboardPointsRules, bet: LeaderboardQualifyingBet): number {
  const base = (bet.stakeCents / 100) * rules.pointsPerEuroStaked;
  return Math.round(rules.useCombinedOddsAsMultiplier ? base * bet.effectiveCombinedOdds : base);
}

export type SettledBetOutcome = 'WON' | 'LOST' | 'VOID' | 'PENDING';

/**
 * Whether a settled bet's outcome earns leaderboard points at all, before
 * the points formula even runs. onlySettledWonCounts=true restricts to WON
 * only; false counts every terminal (non-PENDING) outcome that still
 * qualifies against the campaign's bet spec.
 */
export function leaderboardBetCounts(onlySettledWonCounts: boolean, overallStatus: SettledBetOutcome): boolean {
  if (overallStatus === 'PENDING') {
    return false;
  }
  return onlySettledWonCounts ? overallStatus === 'WON' : true;
}

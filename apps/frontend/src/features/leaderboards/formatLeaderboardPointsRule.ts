import type { LeaderboardCampaign } from '../../lib/backendApi';

/** One sentence describing how points are earned - mirrors formatCampaignRequirements's "auto-derive from config, never a canned marketing line" approach. */
export function formatLeaderboardPointsRule(
  campaign: Pick<LeaderboardCampaign, 'pointsPerEuroStaked' | 'useCombinedOddsAsMultiplier' | 'onlySettledWonCounts'>,
): string {
  const perEuro = campaign.pointsPerEuroStaked;
  const base = `Earn ${perEuro} point${perEuro === 1 ? '' : 's'} per €1 staked`;
  const multiplier = campaign.useCombinedOddsAsMultiplier ? ', multiplied by your bet’s combined odds' : '';
  const scope = campaign.onlySettledWonCounts ? ' on bets that win' : ' on qualifying bets, win or lose';
  return `${base}${multiplier}${scope}.`;
}

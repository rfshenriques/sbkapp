import type { BetAndGetCampaign } from '../../lib/backendApi';

type RequirementFields = Pick<BetAndGetCampaign, 'minStakeCents' | 'minOddsPerLeg' | 'betType' | 'minSelections'>;

/** Short, player-facing phrases for whichever qualifying conditions a campaign actually has set - an unset condition is simply omitted, never shown as "no minimum". */
export function formatCampaignRequirements(campaign: RequirementFields): string[] {
  const requirements: string[] = [];

  if (campaign.minStakeCents !== null) {
    requirements.push(`Min stake ${(campaign.minStakeCents / 100).toFixed(2)} €`);
  }
  if (campaign.minOddsPerLeg !== null) {
    requirements.push(`Min odds ${campaign.minOddsPerLeg.toFixed(2)} per leg`);
  }
  if (campaign.betType === 'SINGLES_ONLY') {
    requirements.push('Singles only');
  } else if (campaign.betType === 'ACCUMULATOR_ONLY') {
    requirements.push(
      campaign.minSelections !== null ? `Accumulator only, min ${campaign.minSelections} selections` : 'Accumulator only',
    );
  } else if (campaign.minSelections !== null) {
    requirements.push(`Min ${campaign.minSelections} selections if accumulator`);
  }

  return requirements;
}

/** One sentence describing when the reward is granted - PLACEMENT is immediate, SETTLEMENT depends on the campaign's chosen outcome flags. */
export function formatCampaignTrigger(campaign: Pick<BetAndGetCampaign, 'trigger' | 'triggerOnWon' | 'triggerOnLost' | 'triggerOnVoid'>): string {
  if (campaign.trigger === 'PLACEMENT') {
    return 'Freebet credited as soon as you place a qualifying bet.';
  }
  const outcomes = [
    campaign.triggerOnWon && 'wins',
    campaign.triggerOnLost && 'loses',
    campaign.triggerOnVoid && 'is voided',
  ].filter(Boolean) as string[];
  if (outcomes.length === 0) {
    return 'Freebet credited once your qualifying bet settles.';
  }
  return `Freebet credited once your qualifying bet ${outcomes.join(' or ')}.`;
}

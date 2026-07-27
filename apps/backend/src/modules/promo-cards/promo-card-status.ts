import { isCampaignScheduledActive, type CampaignSchedule } from '../bet-and-get/bet-and-get';

export type PromoCardStatus = 'ACTIVE' | 'EARLY_ENDED' | 'DISABLED';

/**
 * A card's status is always derived live from its linked campaign, never
 * persisted - so disabling/re-enabling a campaign, or its endAt simply
 * passing, changes what players see without any sync step. A card with no
 * linked campaign at all (purely decorative, staff-uploaded) is always
 * ACTIVE - nothing to derive it from.
 *
 * DISABLED covers both "off" (enabled: false) and "not started yet"
 * (startAt in the future) - neither is a real, live campaign yet, so
 * there's nothing honest to show a player for either case. EARLY_ENDED is
 * the one case that still renders (see ChallengesPage), just visually
 * marked as over.
 */
export function campaignPromoStatus(
  campaign: CampaignSchedule | null,
  now: Date = new Date(),
): PromoCardStatus {
  if (!campaign) {
    return 'ACTIVE';
  }
  if (isCampaignScheduledActive(campaign, now)) {
    return 'ACTIVE';
  }
  if (campaign.enabled && campaign.endAt !== null && now > campaign.endAt) {
    return 'EARLY_ENDED';
  }
  return 'DISABLED';
}

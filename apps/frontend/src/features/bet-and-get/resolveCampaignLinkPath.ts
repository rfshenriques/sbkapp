import type { Match } from '@sportsbook/shared';

/**
 * Where a click on a campaign (a promo card, a "view campaign" link, ...)
 * should land: straight at the single match when the campaign's scope
 * resolves to exactly one, otherwise the campaign-matches listing page.
 * Shared by CampaignMatchesPage's own single-match redirect and, later,
 * the promo-card click-through - both need the identical rule.
 */
export function resolveCampaignLinkPath(campaignId: string, matches: Match[]): string {
  if (matches.length === 1) {
    return `/matches/${matches[0]!.id}`;
  }
  return `/campaigns/${campaignId}`;
}

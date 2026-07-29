import { Controller, Get, Headers, NotFoundException, Param } from '@nestjs/common';
import { PricedMatchesService } from '../margins/priced-matches.service';
import { ViewerResolverService } from '../margins/viewer-resolver.service';
import { matchIsInCampaignScope, matchTimingQualifies } from './bet-and-get';
import { BetAndGetCampaignService } from './bet-and-get-campaign.service';

/**
 * Unauthenticated, player-facing - backs the promotions/promo-card
 * click-through flow (apps/frontend) and the match-detail context banner.
 * Only ever surfaces enabled campaigns - a disabled one is a draft, not a
 * "closed" promo, so it's simply invisible here.
 */
@Controller('public/bet-and-get-campaigns')
export class BetAndGetPublicController {
  constructor(
    private readonly betAndGetCampaignService: BetAndGetCampaignService,
    private readonly pricedMatchesService: PricedMatchesService,
    private readonly viewerResolverService: ViewerResolverService,
  ) {}

  @Get(':brandId')
  list(@Param('brandId') brandId: string) {
    return this.betAndGetCampaignService.listEnabled(brandId);
  }

  /** Every match currently in scope for this campaign - the promo card click-through resolves this and either shows the list (>1 match) or jumps straight to the single match. */
  @Get(':brandId/:campaignId/matches')
  async matchesForCampaign(
    @Param('brandId') brandId: string,
    @Param('campaignId') campaignId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const campaigns = await this.betAndGetCampaignService.listEnabled(brandId);
    const campaign = campaigns.find((entry) => entry.id === campaignId);
    if (!campaign) {
      throw new NotFoundException('Bet & Get campaign not found');
    }

    const viewer = await this.viewerResolverService.resolve(authorization);
    const matches = await this.pricedMatchesService.listForBrand(brandId, viewer);
    return matches.filter((match) =>
      matchIsInCampaignScope(campaign.scopes, {
        sport: match.sport,
        competition: match.competition,
        matchId: match.id,
        isLive: match.isLive,
      }) && matchTimingQualifies(campaign.bettingTiming, match.isLive),
    );
  }

  /** Every enabled campaign covering this one match - backs the match-detail context banner ("this match qualifies for X - bet Y+ on Z odds to get a £W freebet"). */
  @Get(':brandId/match/:matchId')
  async forMatch(
    @Param('brandId') brandId: string,
    @Param('matchId') matchId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer = await this.viewerResolverService.resolve(authorization);
    const match = await this.pricedMatchesService.getForBrand(brandId, matchId, viewer);
    return this.betAndGetCampaignService.findActiveForMatch(
      brandId,
      {
        sport: match.sport,
        competition: match.competition,
        matchId: match.id,
        isLive: match.isLive,
      },
      viewer,
    );
  }
}

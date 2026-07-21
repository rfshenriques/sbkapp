import { Controller, Get, Param } from '@nestjs/common';
import { MarginPricingService } from './margin-pricing.service';
import { OddsEngineClient } from './odds-engine-client';

/**
 * Unauthenticated, player-facing - apps/frontend fetches matches/odds from
 * here instead of odds-engine directly, so every price a player sees has
 * already had the acting brand's trading margin applied (see
 * MarginPricingService). apps/backoffice keeps hitting odds-engine
 * directly for the raw feed price traders are actually setting margin
 * against.
 */
@Controller('public/matches')
export class PublicMatchesController {
  constructor(
    private readonly oddsEngineClient: OddsEngineClient,
    private readonly marginPricingService: MarginPricingService,
  ) {}

  @Get(':brandId')
  async listForBrand(@Param('brandId') brandId: string) {
    const matches = await this.oddsEngineClient.fetchMatches();
    return this.marginPricingService.applyMarginToMatches(brandId, matches);
  }

  @Get(':brandId/:matchId')
  async getForBrand(@Param('brandId') brandId: string, @Param('matchId') matchId: string) {
    const match = await this.oddsEngineClient.fetchMatchById(matchId);
    const [priced] = await this.marginPricingService.applyMarginToMatches(brandId, [match]);
    return priced;
  }
}

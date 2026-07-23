import { Controller, Get, Param } from '@nestjs/common';
import { ManualMarketService } from '../manual-markets/manual-market.service';
import { OddsOverrideService } from '../odds-override/odds-override.service';
import { MarginPricingService } from './margin-pricing.service';
import { OddsEngineClient } from './odds-engine-client';

/**
 * Unauthenticated, player-facing - apps/frontend fetches matches/odds from
 * here instead of odds-engine directly. Pipeline order: raw feed odds get
 * the acting brand's trading margin applied (MarginPricingService), then
 * any trader-created market with no feed equivalent is appended
 * (ManualMarketService), then any trader-set fixed price is substituted in
 * (OddsOverrideService, applied last so it always wins - including on a
 * manual market's own selections). apps/backoffice keeps hitting
 * odds-engine directly for the raw feed price traders are actually setting
 * margin and overrides against.
 */
@Controller('public/matches')
export class PublicMatchesController {
  constructor(
    private readonly oddsEngineClient: OddsEngineClient,
    private readonly marginPricingService: MarginPricingService,
    private readonly manualMarketService: ManualMarketService,
    private readonly oddsOverrideService: OddsOverrideService,
  ) {}

  @Get(':brandId')
  async listForBrand(@Param('brandId') brandId: string) {
    const matches = await this.oddsEngineClient.fetchMatches();
    const priced = await this.marginPricingService.applyMarginToMatches(brandId, matches);
    const withManualMarkets = await this.manualMarketService.mergeIntoMatches(brandId, priced);
    return this.oddsOverrideService.applyOverrides(brandId, withManualMarkets);
  }

  @Get(':brandId/:matchId')
  async getForBrand(@Param('brandId') brandId: string, @Param('matchId') matchId: string) {
    const match = await this.oddsEngineClient.fetchMatchById(matchId);
    const [priced] = await this.marginPricingService.applyMarginToMatches(brandId, [match]);
    const [withManualMarkets] = await this.manualMarketService.mergeIntoMatches(brandId, [priced!]);
    const [overridden] = await this.oddsOverrideService.applyOverrides(brandId, [withManualMarkets!]);
    return overridden;
  }
}

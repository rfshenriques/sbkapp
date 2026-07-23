import { Controller, Get, Param } from '@nestjs/common';
import { BoostService } from '../boosts/boost.service';
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
 * (OddsOverrideService), then any trader-configured boost climbs the
 * result up the brand's odds ladder (BoostService, applied last so "the
 * price it would otherwise show" already accounts for margin, manual
 * markets, and overrides). apps/backoffice keeps hitting odds-engine
 * directly for the raw feed price traders are actually setting margin,
 * overrides, and boosts against.
 */
@Controller('public/matches')
export class PublicMatchesController {
  constructor(
    private readonly oddsEngineClient: OddsEngineClient,
    private readonly marginPricingService: MarginPricingService,
    private readonly manualMarketService: ManualMarketService,
    private readonly oddsOverrideService: OddsOverrideService,
    private readonly boostService: BoostService,
  ) {}

  @Get(':brandId')
  async listForBrand(@Param('brandId') brandId: string) {
    const matches = await this.oddsEngineClient.fetchMatches();
    const priced = await this.marginPricingService.applyMarginToMatches(brandId, matches);
    const withManualMarkets = await this.manualMarketService.mergeIntoMatches(brandId, priced);
    const overridden = await this.oddsOverrideService.applyOverrides(brandId, withManualMarkets);
    return this.boostService.applyBoosts(brandId, overridden);
  }

  @Get(':brandId/:matchId')
  async getForBrand(@Param('brandId') brandId: string, @Param('matchId') matchId: string) {
    const match = await this.oddsEngineClient.fetchMatchById(matchId);
    const [priced] = await this.marginPricingService.applyMarginToMatches(brandId, [match]);
    const [withManualMarkets] = await this.manualMarketService.mergeIntoMatches(brandId, [priced!]);
    const [overridden] = await this.oddsOverrideService.applyOverrides(brandId, [withManualMarkets!]);
    const [boosted] = await this.boostService.applyBoosts(brandId, [overridden!]);
    return boosted;
  }
}

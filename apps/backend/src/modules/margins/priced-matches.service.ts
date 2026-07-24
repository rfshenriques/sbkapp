import { Injectable } from '@nestjs/common';
import type { Match } from '@sportsbook/shared';
import type { AudienceViewer } from '../audience/audience';
import { BoostService } from '../boosts/boost.service';
import { ManualMarketService } from '../manual-markets/manual-market.service';
import { OddsOverrideService } from '../odds-override/odds-override.service';
import { MarginPricingService } from './margin-pricing.service';
import { OddsEngineClient } from './odds-engine-client';

/**
 * The shared match-pricing pipeline - raw feed odds get the acting brand's
 * trading margin applied, then any manual market is appended, then any
 * fixed price override is substituted in, then any boost climbs the result
 * up the odds ladder (applied last so "the price it would otherwise show"
 * already accounts for margin, manual markets, and overrides). Reused by
 * every public endpoint that needs fully-priced matches: the main board
 * (PublicMatchesController) and the Specials/Boosts aggregate pages.
 */
@Injectable()
export class PricedMatchesService {
  constructor(
    private readonly oddsEngineClient: OddsEngineClient,
    private readonly marginPricingService: MarginPricingService,
    private readonly manualMarketService: ManualMarketService,
    private readonly oddsOverrideService: OddsOverrideService,
    private readonly boostService: BoostService,
  ) {}

  async listForBrand(brandId: string, viewer: AudienceViewer): Promise<Match[]> {
    const matches = await this.oddsEngineClient.fetchMatches();
    return this.priceMatches(brandId, matches, viewer);
  }

  async getForBrand(brandId: string, matchId: string, viewer: AudienceViewer): Promise<Match> {
    const match = await this.oddsEngineClient.fetchMatchById(matchId);
    const [priced] = await this.priceMatches(brandId, [match], viewer);
    return priced!;
  }

  private async priceMatches(brandId: string, matches: Match[], viewer: AudienceViewer): Promise<Match[]> {
    const priced = await this.marginPricingService.applyMarginToMatches(brandId, matches);
    const withManualMarkets = await this.manualMarketService.mergeIntoMatches(brandId, priced, viewer);
    const overridden = await this.oddsOverrideService.applyOverrides(brandId, withManualMarkets);
    return this.boostService.applyBoosts(brandId, overridden, viewer);
  }
}

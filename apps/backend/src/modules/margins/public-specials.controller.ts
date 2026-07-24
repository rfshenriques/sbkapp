import { Controller, Get, Headers, Param } from '@nestjs/common';
import type { Match } from '@sportsbook/shared';
import { PricedMatchesService } from './priced-matches.service';
import { ViewerResolverService } from './viewer-resolver.service';

/**
 * Unauthenticated, player-facing - backs the Specials page (apps/frontend).
 * Every manual market (ManualMarketService.mergeIntoMatches sets
 * Market.isSpecial = true) auto-joins this list, grouped per match; matches
 * with no specials configured are omitted rather than returned empty.
 */
@Controller('public/specials')
export class PublicSpecialsController {
  constructor(
    private readonly pricedMatchesService: PricedMatchesService,
    private readonly viewerResolverService: ViewerResolverService,
  ) {}

  @Get(':brandId')
  async listForBrand(@Param('brandId') brandId: string, @Headers('authorization') authorization?: string): Promise<Match[]> {
    const viewer = await this.viewerResolverService.resolve(authorization);
    const matches = await this.pricedMatchesService.listForBrand(brandId, viewer);
    return matches
      .map((match) => ({ ...match, markets: match.markets.filter((market) => market.isSpecial === true) }))
      .filter((match) => match.markets.length > 0);
  }
}

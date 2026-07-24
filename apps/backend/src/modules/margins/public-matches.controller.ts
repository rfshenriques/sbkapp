import { Controller, Get, Headers, Param } from '@nestjs/common';
import { PricedMatchesService } from './priced-matches.service';
import { ViewerResolverService } from './viewer-resolver.service';

/**
 * Unauthenticated, player-facing - apps/frontend fetches matches/odds from
 * here instead of odds-engine directly. See PricedMatchesService for the
 * pricing pipeline. apps/backoffice keeps hitting odds-engine directly for
 * the raw feed price traders are actually setting margin, overrides, and
 * boosts against.
 */
@Controller('public/matches')
export class PublicMatchesController {
  constructor(
    private readonly pricedMatchesService: PricedMatchesService,
    private readonly viewerResolverService: ViewerResolverService,
  ) {}

  @Get(':brandId')
  async listForBrand(@Param('brandId') brandId: string, @Headers('authorization') authorization?: string) {
    const viewer = await this.viewerResolverService.resolve(authorization);
    return this.pricedMatchesService.listForBrand(brandId, viewer);
  }

  @Get(':brandId/:matchId')
  async getForBrand(
    @Param('brandId') brandId: string,
    @Param('matchId') matchId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer = await this.viewerResolverService.resolve(authorization);
    return this.pricedMatchesService.getForBrand(brandId, matchId, viewer);
  }
}

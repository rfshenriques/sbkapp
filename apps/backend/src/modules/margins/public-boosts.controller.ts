import { Controller, Get, Headers, Param } from '@nestjs/common';
import type { BoostedSelectionSummary } from '@sportsbook/shared';
import { PricedMatchesService } from './priced-matches.service';
import { ViewerResolverService } from './viewer-resolver.service';

/**
 * Unauthenticated, player-facing - backs the Boosts page (apps/frontend).
 * Every configured boost (BoostService.applyBoosts sets Selection.originalOdds)
 * auto-joins this list, flattened to one line item per boosted selection so
 * the page can group by sport without re-deriving anything from the match tree.
 */
@Controller('public/boosts')
export class PublicBoostsController {
  constructor(
    private readonly pricedMatchesService: PricedMatchesService,
    private readonly viewerResolverService: ViewerResolverService,
  ) {}

  @Get(':brandId')
  async listForBrand(
    @Param('brandId') brandId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<BoostedSelectionSummary[]> {
    const viewer = await this.viewerResolverService.resolve(authorization);
    const matches = await this.pricedMatchesService.listForBrand(brandId, viewer);

    const lineItems: BoostedSelectionSummary[] = [];
    for (const match of matches) {
      for (const market of match.markets) {
        for (const selection of market.selections) {
          if (selection.originalOdds === undefined) {
            continue;
          }
          lineItems.push({
            matchId: match.id,
            sport: match.sport,
            country: match.country,
            competition: match.competition,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            kickoff: match.kickoff,
            isLive: match.isLive,
            marketId: market.id,
            marketName: market.name,
            selectionId: selection.id,
            selectionName: selection.name,
            previousOdds: selection.originalOdds,
            odds: selection.odds,
            maxStakeCents: selection.maxStakeCents,
          });
        }
      }
    }
    return lineItems;
  }
}

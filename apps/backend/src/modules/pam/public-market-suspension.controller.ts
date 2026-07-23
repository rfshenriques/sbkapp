import { Controller, Get, Param } from '@nestjs/common';
import { MarketSuspensionService } from './market-suspension.service';

/**
 * Unauthenticated, player-facing - apps/frontend needs to know which
 * matches/markets/selections are currently suspended so it can grey out
 * those selections and show a lock icon instead of odds, rather than only
 * finding out when placeBet rejects the bet (see PamService.placeBet).
 * Only matchId/marketId/selectionId is exposed - no suspension id, no
 * reason, no brand internals (same reasoning as
 * PublicCompetitionRankingController). An empty marketId means the whole
 * match; an empty selectionId (with a marketId set) means the whole
 * market - same marker convention MarketSuspensionService stores.
 */
@Controller('public/market-suspensions')
export class PublicMarketSuspensionController {
  constructor(private readonly marketSuspensionService: MarketSuspensionService) {}

  @Get(':brandId')
  async listForBrand(@Param('brandId') brandId: string) {
    const suspensions = await this.marketSuspensionService.listSuspensions(brandId);
    return suspensions.map((suspension) => ({
      matchId: suspension.matchId,
      marketId: suspension.marketId,
      selectionId: suspension.selectionId,
    }));
  }
}

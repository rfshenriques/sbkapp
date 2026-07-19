import { Controller, Get, Param } from '@nestjs/common';
import { CompetitionRankingService } from './competition-ranking.service';

/**
 * Unauthenticated - apps/frontend's sport page needs this to sort matches
 * "most important first" for anonymous browsing too (see
 * PublicBrandController for the same "player-facing, no login" reasoning).
 * Only competition + rank is exposed - no ids, no brand internals.
 */
@Controller('public/competition-rankings')
export class PublicCompetitionRankingController {
  constructor(private readonly competitionRankingService: CompetitionRankingService) {}

  @Get(':brandId')
  async listForBrand(@Param('brandId') brandId: string) {
    const rankings = await this.competitionRankingService.listRankings(brandId);
    return rankings.map((ranking) => ({ competition: ranking.competition, rank: ranking.rank }));
  }
}

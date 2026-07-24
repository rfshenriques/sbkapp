import { Controller, Get, Param } from '@nestjs/common';
import { CompetitionQuicklinkService } from './competition-quicklink.service';

/**
 * Unauthenticated - apps/frontend's sidebar needs this to render the "Top
 * Competitions" shortcut list for anonymous browsing too (see
 * PublicCompetitionRankingController for the same reasoning). Only
 * competition + order is exposed - no ids, no brand internals.
 */
@Controller('public/competition-quicklinks')
export class PublicCompetitionQuicklinkController {
  constructor(private readonly competitionQuicklinkService: CompetitionQuicklinkService) {}

  @Get(':brandId')
  async listForBrand(@Param('brandId') brandId: string) {
    const quicklinks = await this.competitionQuicklinkService.listQuicklinks(brandId);
    return quicklinks.map((quicklink) => ({ competition: quicklink.competition, order: quicklink.order }));
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { CompetitionSuspensionService } from './competition-suspension.service';

/**
 * Unauthenticated, player-facing - apps/frontend needs to know which
 * competitions are currently suspended so it can grey out every match
 * within one, same reasoning as PublicMarketSuspensionController. Only the
 * competition name is exposed - no suspension id, no reason.
 */
@Controller('public/competition-suspensions')
export class PublicCompetitionSuspensionController {
  constructor(private readonly competitionSuspensionService: CompetitionSuspensionService) {}

  @Get(':brandId')
  async listForBrand(@Param('brandId') brandId: string) {
    const suspensions = await this.competitionSuspensionService.listSuspensions(brandId);
    return suspensions.map((suspension) => suspension.competition);
  }
}

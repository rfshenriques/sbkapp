import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SetCompetitionRankingDto } from './dto/set-competition-ranking.dto';
import { CompetitionRankingService } from './competition-ranking.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS')
@Controller('admin/competition-rankings')
export class CompetitionRankingController {
  constructor(private readonly competitionRankingService: CompetitionRankingService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.competitionRankingService.listRankings(req.user.brandId);
  }

  @Post()
  set(@Body() dto: SetCompetitionRankingDto, @Req() req: AuthenticatedStaffRequest) {
    return this.competitionRankingService.setRanking(req.user.brandId, dto.competition, dto.rank, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.competitionRankingService.removeRanking(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SetCompetitionTierDto } from './dto/set-competition-tier.dto';
import { CompetitionTierService } from './competition-tier.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/competition-tiers')
export class CompetitionTierController {
  constructor(private readonly competitionTierService: CompetitionTierService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.competitionTierService.listTiers(req.user.brandId);
  }

  @Post()
  set(@Body() dto: SetCompetitionTierDto, @Req() req: AuthenticatedStaffRequest) {
    return this.competitionTierService.setTier(req.user.brandId, dto.competition, dto.tier, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.competitionTierService.removeTier(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

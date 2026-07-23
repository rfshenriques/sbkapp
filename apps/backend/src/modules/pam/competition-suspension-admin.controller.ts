import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { CompetitionSuspensionService } from './competition-suspension.service';
import { SuspendCompetitionDto } from './dto/suspend-competition.dto';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/competition-suspensions')
export class CompetitionSuspensionAdminController {
  constructor(private readonly competitionSuspensionService: CompetitionSuspensionService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.competitionSuspensionService.listSuspensions(req.user.brandId);
  }

  @Post()
  suspend(@Body() dto: SuspendCompetitionDto, @Req() req: AuthenticatedStaffRequest) {
    return this.competitionSuspensionService.suspend(req.user.brandId, dto.competition, dto.reason, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  unsuspend(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.competitionSuspensionService.unsuspend(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

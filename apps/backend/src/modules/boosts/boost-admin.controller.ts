import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { BoostService } from './boost.service';
import { SetBoostDto } from './dto/set-boost.dto';
import { SetBoostLimitsDto } from './dto/set-boost-limits.dto';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/boosts')
export class BoostAdminController {
  constructor(private readonly boostService: BoostService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.boostService.listBoosts(req.user.brandId);
  }

  @Post()
  setBoost(@Body() dto: SetBoostDto, @Req() req: AuthenticatedStaffRequest) {
    return this.boostService.setBoost(
      req.user.brandId,
      dto.matchId,
      dto.marketId,
      dto.selectionId,
      dto.ticks,
      dto.reason,
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Delete(':id')
  clearBoost(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.boostService.clearBoost(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Patch(':id/limits')
  setLimits(@Param('id') id: string, @Body() dto: SetBoostLimitsDto, @Req() req: AuthenticatedStaffRequest) {
    return this.boostService.setLimits(req.user.brandId, id, dto, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

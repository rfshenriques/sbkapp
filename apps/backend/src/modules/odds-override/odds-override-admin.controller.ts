import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SetOddsOverrideDto } from './dto/set-odds-override.dto';
import { OddsOverrideService } from './odds-override.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/odds-overrides')
export class OddsOverrideAdminController {
  constructor(private readonly oddsOverrideService: OddsOverrideService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.oddsOverrideService.listOverrides(req.user.brandId);
  }

  @Post()
  setOverride(@Body() dto: SetOddsOverrideDto, @Req() req: AuthenticatedStaffRequest) {
    return this.oddsOverrideService.setOverride(
      req.user.brandId,
      dto.matchId,
      dto.marketId,
      dto.selectionId,
      dto.oddsValue,
      dto.reason,
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Delete(':id')
  clearOverride(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.oddsOverrideService.clearOverride(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

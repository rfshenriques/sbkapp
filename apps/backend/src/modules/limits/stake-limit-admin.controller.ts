import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SetStakeLimitDto } from './dto/set-stake-limit.dto';
import { StakeLimitService } from './stake-limit.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/stake-limits')
export class StakeLimitAdminController {
  constructor(private readonly stakeLimitService: StakeLimitService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.stakeLimitService.list(req.user.brandId);
  }

  @Post()
  set(@Body() dto: SetStakeLimitDto, @Req() req: AuthenticatedStaffRequest) {
    return this.stakeLimitService.set(
      req.user.brandId,
      {
        scope: dto.scope,
        scopeValue: dto.scopeValue,
        tier: dto.tier,
        maxStakeCents: dto.maxStakeCents ?? null,
        maxLiabilityCents: dto.maxLiabilityCents ?? null,
      },
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.stakeLimitService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

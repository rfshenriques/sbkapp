import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { AccaBoostService } from './acca-boost.service';
import { SetAccaBoostConfigDto } from './dto/set-acca-boost-config.dto';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/acca-boost-config')
export class AccaBoostAdminController {
  constructor(private readonly accaBoostService: AccaBoostService) {}

  @Get()
  get(@Req() req: AuthenticatedStaffRequest) {
    return this.accaBoostService.getConfig(req.user.brandId);
  }

  @Put()
  set(@Body() dto: SetAccaBoostConfigDto, @Req() req: AuthenticatedStaffRequest) {
    return this.accaBoostService.setConfig(req.user.brandId, dto, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

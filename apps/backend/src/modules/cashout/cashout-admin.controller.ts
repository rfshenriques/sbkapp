import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { CashoutService } from './cashout.service';
import { SetCashoutConfigDto } from './dto/set-cashout-config.dto';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/cashout-config')
export class CashoutAdminController {
  constructor(private readonly cashoutService: CashoutService) {}

  @Get()
  get(@Req() req: AuthenticatedStaffRequest) {
    return this.cashoutService.getConfig(req.user.brandId);
  }

  @Put()
  set(@Body() dto: SetCashoutConfigDto, @Req() req: AuthenticatedStaffRequest) {
    return this.cashoutService.setConfig(req.user.brandId, dto, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { InsuranceBetService } from './insurance-bet.service';
import { SetInsuranceBetConfigDto } from './dto/set-insurance-bet-config.dto';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/insurance-bet-config')
export class InsuranceBetAdminController {
  constructor(private readonly insuranceBetService: InsuranceBetService) {}

  @Get()
  get(@Req() req: AuthenticatedStaffRequest) {
    return this.insuranceBetService.getConfig(req.user.brandId);
  }

  @Put()
  set(@Body() dto: SetInsuranceBetConfigDto, @Req() req: AuthenticatedStaffRequest) {
    return this.insuranceBetService.setConfig(req.user.brandId, dto, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

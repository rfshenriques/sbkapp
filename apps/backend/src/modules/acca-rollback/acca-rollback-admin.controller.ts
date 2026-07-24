import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { AccaRollbackService } from './acca-rollback.service';
import { SetAccaRollbackConfigDto } from './dto/set-acca-rollback-config.dto';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/acca-rollback-config')
export class AccaRollbackAdminController {
  constructor(private readonly accaRollbackService: AccaRollbackService) {}

  @Get()
  get(@Req() req: AuthenticatedStaffRequest) {
    return this.accaRollbackService.getConfig(req.user.brandId);
  }

  @Put()
  set(@Body() dto: SetAccaRollbackConfigDto, @Req() req: AuthenticatedStaffRequest) {
    return this.accaRollbackService.setConfig(req.user.brandId, dto, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

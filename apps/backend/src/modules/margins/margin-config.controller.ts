import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SetMarginConfigDto } from './dto/set-margin-config.dto';
import { MarginConfigService } from './margin-config.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/margin-configs')
export class MarginConfigController {
  constructor(private readonly marginConfigService: MarginConfigService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.marginConfigService.listMargins(req.user.brandId);
  }

  @Post()
  set(@Body() dto: SetMarginConfigDto, @Req() req: AuthenticatedStaffRequest) {
    return this.marginConfigService.setMargin(
      req.user.brandId,
      dto.marketName,
      dto.tier,
      dto.marginPercent,
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.marginConfigService.removeMargin(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

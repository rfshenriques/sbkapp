import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { CreateManualMarketDto } from './dto/create-manual-market.dto';
import { SetManualMarketLimitsDto } from './dto/set-manual-market-limits.dto';
import { UpdateManualMarketDto } from './dto/update-manual-market.dto';
import { ManualMarketService } from './manual-market.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/manual-markets')
export class ManualMarketAdminController {
  constructor(private readonly manualMarketService: ManualMarketService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.manualMarketService.listMarkets(req.user.brandId);
  }

  @Post()
  create(@Body() dto: CreateManualMarketDto, @Req() req: AuthenticatedStaffRequest) {
    return this.manualMarketService.createMarket(req.user.brandId, dto.matchId, dto.name, dto.selections, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateManualMarketDto, @Req() req: AuthenticatedStaffRequest) {
    return this.manualMarketService.updateMarket(req.user.brandId, id, dto.name, dto.selections, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.manualMarketService.removeMarket(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Patch(':id/limits')
  setLimits(
    @Param('id') id: string,
    @Body() dto: SetManualMarketLimitsDto,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    return this.manualMarketService.setLimits(req.user.brandId, id, dto, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

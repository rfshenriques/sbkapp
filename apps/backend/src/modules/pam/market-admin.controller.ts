import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SuspendMarketDto } from './dto/suspend-market.dto';
import { MarketSuspensionService } from './market-suspension.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/market-suspensions')
export class MarketAdminController {
  constructor(private readonly marketSuspensionService: MarketSuspensionService) {}

  @Get()
  list() {
    return this.marketSuspensionService.listSuspensions();
  }

  @Post()
  suspend(@Body() dto: SuspendMarketDto, @Req() req: AuthenticatedStaffRequest) {
    return this.marketSuspensionService.suspend(dto.matchId, dto.marketId, dto.reason, {
      id: req.user.sub,
      username: req.user.username,
    });
  }

  @Delete(':id')
  unsuspend(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.marketSuspensionService.unsuspend(id, {
      id: req.user.sub,
      username: req.user.username,
    });
  }
}

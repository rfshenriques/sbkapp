import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { ListBetsQueryDto } from './dto/list-bets-query.dto';
import { SettleSelectionDto } from './dto/settle-selection.dto';
import { PamService } from './pam.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin')
export class PamAdminController {
  constructor(private readonly pamService: PamService) {}

  @Get('bets')
  listBets(@Query() query: ListBetsQueryDto, @Req() req: AuthenticatedStaffRequest) {
    return this.pamService.listBetsForSettlement(req.user.brandId, {
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      player: query.player,
      fundedByFreebets: query.fundedByFreebets,
      insured: query.insured,
      boosted: query.boosted,
      hasCampaign: query.hasCampaign,
      sport: query.sport,
      competition: query.competition,
    });
  }

  @Get('bets/filter-options')
  listBetFilterOptions(@Req() req: AuthenticatedStaffRequest) {
    return this.pamService.listBetFilterOptions(req.user.brandId);
  }

  @Patch('bets/:betId/selections/:selectionId/settlement')
  settleSelection(
    @Param('betId') betId: string,
    @Param('selectionId') selectionId: string,
    @Body() dto: SettleSelectionDto,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    return this.pamService.settleSelection(req.user.brandId, betId, selectionId, dto.status, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}

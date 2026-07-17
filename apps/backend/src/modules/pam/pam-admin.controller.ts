import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import { ListBetsQueryDto } from './dto/list-bets-query.dto';
import { SettleSelectionDto } from './dto/settle-selection.dto';
import { PamService } from './pam.service';

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin')
export class PamAdminController {
  constructor(private readonly pamService: PamService) {}

  @Get('bets')
  listBets(@Query() query: ListBetsQueryDto) {
    return this.pamService.listBetsForSettlement(query.status);
  }

  @Patch('bets/:betId/selections/:selectionId/settlement')
  settleSelection(
    @Param('betId') betId: string,
    @Param('selectionId') selectionId: string,
    @Body() dto: SettleSelectionDto,
  ) {
    return this.pamService.settleSelection(betId, selectionId, dto.status);
  }
}

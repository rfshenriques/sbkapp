import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';
import { ListBetsQueryDto } from './dto/list-bets-query.dto';
import { SettleSelectionDto } from './dto/settle-selection.dto';
import { PamService } from './pam.service';

@UseGuards(AdminKeyGuard)
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

import { Controller, Get, Param } from '@nestjs/common';
import { CashoutService } from './cashout.service';

/**
 * Unauthenticated, player-facing - apps/frontend needs to know whether
 * cashout is even enabled before it bothers asking for a quote. Same shape
 * as CashoutAdminController's GET, just without auth.
 */
@Controller('public/cashout-config')
export class PublicCashoutConfigController {
  constructor(private readonly cashoutService: CashoutService) {}

  @Get(':brandId')
  getForBrand(@Param('brandId') brandId: string) {
    return this.cashoutService.getConfig(brandId);
  }
}

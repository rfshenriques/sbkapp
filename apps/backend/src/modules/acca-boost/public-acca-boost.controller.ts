import { Controller, Get, Param } from '@nestjs/common';
import { AccaBoostService } from './acca-boost.service';

/**
 * Unauthenticated, player-facing - apps/frontend needs the full config
 * (not just a flag) to show the bet slip's "N more selections for the acca
 * boost" progress bar and preview the boosted payout before a bet is ever
 * placed. Same shape as AccaBoostAdminController's GET, just without auth.
 */
@Controller('public/acca-boost-config')
export class PublicAccaBoostController {
  constructor(private readonly accaBoostService: AccaBoostService) {}

  @Get(':brandId')
  getForBrand(@Param('brandId') brandId: string) {
    return this.accaBoostService.getConfig(brandId);
  }
}

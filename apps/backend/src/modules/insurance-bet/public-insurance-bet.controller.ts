import { Controller, Get, Param } from '@nestjs/common';
import { InsuranceBetService } from './insurance-bet.service';

/**
 * Unauthenticated, player-facing - apps/frontend needs the full config
 * (not just a flag) to show the bet slip's insurance toggle and preview the
 * discounted payout before a bet is ever placed. Same shape as
 * InsuranceBetAdminController's GET, just without auth.
 */
@Controller('public/insurance-bet-config')
export class PublicInsuranceBetController {
  constructor(private readonly insuranceBetService: InsuranceBetService) {}

  @Get(':brandId')
  getForBrand(@Param('brandId') brandId: string) {
    return this.insuranceBetService.getConfig(brandId);
  }
}

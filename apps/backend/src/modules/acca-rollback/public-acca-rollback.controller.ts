import { Controller, Get, Param } from '@nestjs/common';
import { AccaRollbackService } from './acca-rollback.service';

/**
 * Unauthenticated, player-facing - apps/frontend needs the full config
 * (not just a flag) to show the bet slip's "will qualify for a rollback" /
 * "N more selections needed" message before a bet is ever placed. Same
 * shape as AccaRollbackAdminController's GET, just without auth.
 */
@Controller('public/acca-rollback-config')
export class PublicAccaRollbackController {
  constructor(private readonly accaRollbackService: AccaRollbackService) {}

  @Get(':brandId')
  getForBrand(@Param('brandId') brandId: string) {
    return this.accaRollbackService.getConfig(brandId);
  }
}

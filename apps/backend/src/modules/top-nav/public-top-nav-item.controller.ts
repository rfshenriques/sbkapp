import { Controller, Get, Param } from '@nestjs/common';
import { TopNavItemService } from './top-nav-item.service';

/**
 * Unauthenticated, player-facing - backs apps/frontend's SecondaryNavBar.
 * Only enabled items (see TopNavItemService.listEnabled), in staff-configured
 * display order.
 */
@Controller('public/top-nav')
export class PublicTopNavItemController {
  constructor(private readonly topNavItemService: TopNavItemService) {}

  @Get(':brandId')
  list(@Param('brandId') brandId: string) {
    return this.topNavItemService.listEnabled(brandId);
  }
}

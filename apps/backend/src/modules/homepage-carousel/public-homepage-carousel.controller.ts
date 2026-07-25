import { Controller, Get, Param } from '@nestjs/common';
import { HomepageCarouselService } from './homepage-carousel.service';

/**
 * Unauthenticated, player-facing - apps/frontend needs this to decide
 * whether/how fast to auto-advance the homepage's "Match of the day +
 * Promotions" carousel row. Same shape as HomepageCarouselAdminController's
 * GET, just without auth.
 */
@Controller('public/homepage-carousel-config')
export class PublicHomepageCarouselController {
  constructor(private readonly homepageCarouselService: HomepageCarouselService) {}

  @Get(':brandId')
  getForBrand(@Param('brandId') brandId: string) {
    return this.homepageCarouselService.getConfig(brandId);
  }
}

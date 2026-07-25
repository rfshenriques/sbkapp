import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { HomepageCarouselAdminController } from './homepage-carousel-admin.controller';
import { HomepageCarouselService } from './homepage-carousel.service';
import { PublicHomepageCarouselController } from './public-homepage-carousel.controller';

@Module({
  imports: [AdminModule],
  controllers: [HomepageCarouselAdminController, PublicHomepageCarouselController],
  providers: [HomepageCarouselService],
  exports: [HomepageCarouselService],
})
export class HomepageCarouselModule {}

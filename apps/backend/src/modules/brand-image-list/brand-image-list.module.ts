import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BrandImageListController } from './brand-image-list.controller';
import { BrandImageListService } from './brand-image-list.service';
import { PublicBrandImageListController } from './public-brand-image-list.controller';

@Module({
  imports: [AdminModule],
  controllers: [BrandImageListController, PublicBrandImageListController],
  providers: [BrandImageListService],
})
export class BrandImageListModule {}

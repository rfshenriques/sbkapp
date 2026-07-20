import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BrandImagesController } from './brand-images.controller';
import { BrandImagesService } from './brand-images.service';
import { PublicBrandImagesController } from './public-brand-images.controller';

@Module({
  imports: [AdminModule],
  controllers: [BrandImagesController, PublicBrandImagesController],
  providers: [BrandImagesService],
})
export class BrandImagesModule {}

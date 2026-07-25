import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PromoCardAdminController } from './promo-card-admin.controller';
import { PromoCardService } from './promo-card.service';
import { PublicPromoCardController } from './public-promo-card.controller';

@Module({
  imports: [AdminModule],
  controllers: [PromoCardAdminController, PublicPromoCardController],
  providers: [PromoCardService],
  exports: [PromoCardService],
})
export class PromoCardModule {}

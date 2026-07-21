import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { CompetitionTierController } from './competition-tier.controller';
import { CompetitionTierService } from './competition-tier.service';
import { MarginConfigController } from './margin-config.controller';
import { MarginConfigService } from './margin-config.service';
import { MarginPricingService } from './margin-pricing.service';

@Module({
  imports: [AdminModule],
  controllers: [CompetitionTierController, MarginConfigController],
  providers: [CompetitionTierService, MarginConfigService, MarginPricingService],
  exports: [MarginPricingService],
})
export class MarginsModule {}

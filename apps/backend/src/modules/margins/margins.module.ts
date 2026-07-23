import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { OddsOverrideModule } from '../odds-override/odds-override.module';
import { CompetitionTierController } from './competition-tier.controller';
import { CompetitionTierService } from './competition-tier.service';
import { MarginConfigController } from './margin-config.controller';
import { MarginConfigService } from './margin-config.service';
import { MarginPricingService } from './margin-pricing.service';
import { OddsEngineClient } from './odds-engine-client';
import { PublicMatchesController } from './public-matches.controller';

@Module({
  imports: [AdminModule, OddsOverrideModule],
  controllers: [CompetitionTierController, MarginConfigController, PublicMatchesController],
  providers: [CompetitionTierService, MarginConfigService, MarginPricingService, OddsEngineClient],
  exports: [MarginPricingService],
})
export class MarginsModule {}

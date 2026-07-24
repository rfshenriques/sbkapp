import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { BoostsModule } from '../boosts/boosts.module';
import { ManualMarketModule } from '../manual-markets/manual-market.module';
import { OddsOverrideModule } from '../odds-override/odds-override.module';
import { PlayerSegmentModule } from '../player-segments/player-segment.module';
import { CompetitionTierController } from './competition-tier.controller';
import { CompetitionTierService } from './competition-tier.service';
import { MarginConfigController } from './margin-config.controller';
import { MarginConfigService } from './margin-config.service';
import { MarginPricingService } from './margin-pricing.service';
import { OddsEngineClient } from './odds-engine-client';
import { PricedMatchesService } from './priced-matches.service';
import { PublicBoostsController } from './public-boosts.controller';
import { PublicMatchesController } from './public-matches.controller';
import { PublicSpecialsController } from './public-specials.controller';
import { ViewerResolverService } from './viewer-resolver.service';

@Module({
  imports: [AdminModule, OddsOverrideModule, ManualMarketModule, BoostsModule, AuthModule, PlayerSegmentModule],
  controllers: [
    CompetitionTierController,
    MarginConfigController,
    PublicMatchesController,
    PublicSpecialsController,
    PublicBoostsController,
  ],
  providers: [
    CompetitionTierService,
    MarginConfigService,
    MarginPricingService,
    OddsEngineClient,
    PricedMatchesService,
    ViewerResolverService,
  ],
  exports: [MarginPricingService, ViewerResolverService],
})
export class MarginsModule {}

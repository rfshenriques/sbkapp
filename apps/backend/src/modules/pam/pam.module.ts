import { Module } from '@nestjs/common';
import { AccaBoostModule } from '../acca-boost/acca-boost.module';
import { AccaRollbackModule } from '../acca-rollback/acca-rollback.module';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { BetAndGetModule } from '../bet-and-get/bet-and-get.module';
import { BoostsModule } from '../boosts/boosts.module';
import { DepositCampaignModule } from '../deposit-campaigns/deposit-campaign.module';
import { FreebetModule } from '../freebets/freebet.module';
import { InsuranceBetModule } from '../insurance-bet/insurance-bet.module';
import { LimitsModule } from '../limits/limits.module';
import { ManualMarketModule } from '../manual-markets/manual-market.module';
import { OddsEngineClient } from '../margins/odds-engine-client';
import { CompetitionSuspensionAdminController } from './competition-suspension-admin.controller';
import { CompetitionSuspensionService } from './competition-suspension.service';
import { MarketAdminController } from './market-admin.controller';
import { MarketSuspensionService } from './market-suspension.service';
import { PamAdminController } from './pam-admin.controller';
import { PamController } from './pam.controller';
import { PamService } from './pam.service';
import { PublicCampaignPreviewController } from './public-campaign-preview.controller';
import { PublicCompetitionSuspensionController } from './public-competition-suspension.controller';
import { PublicMarketSuspensionController } from './public-market-suspension.controller';
import { PublicStakeLimitPreviewController } from './public-stake-limit-preview.controller';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    AccaBoostModule,
    AccaRollbackModule,
    InsuranceBetModule,
    LimitsModule,
    ManualMarketModule,
    BoostsModule,
    FreebetModule,
    BetAndGetModule,
    DepositCampaignModule,
  ],
  controllers: [
    PamController,
    PamAdminController,
    MarketAdminController,
    PublicMarketSuspensionController,
    CompetitionSuspensionAdminController,
    PublicCompetitionSuspensionController,
    PublicStakeLimitPreviewController,
    PublicCampaignPreviewController,
  ],
  providers: [PamService, MarketSuspensionService, CompetitionSuspensionService, OddsEngineClient],
})
export class PamModule {}

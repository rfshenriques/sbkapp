import { Module } from '@nestjs/common';
import { AccaBoostModule } from '../acca-boost/acca-boost.module';
import { AdminModule } from '../admin/admin.module';
import { BoostsModule } from '../boosts/boosts.module';
import { FreebetModule } from '../freebets/freebet.module';
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
import { PublicCompetitionSuspensionController } from './public-competition-suspension.controller';
import { PublicMarketSuspensionController } from './public-market-suspension.controller';

@Module({
  imports: [AdminModule, AccaBoostModule, LimitsModule, ManualMarketModule, BoostsModule, FreebetModule],
  controllers: [
    PamController,
    PamAdminController,
    MarketAdminController,
    PublicMarketSuspensionController,
    CompetitionSuspensionAdminController,
    PublicCompetitionSuspensionController,
  ],
  providers: [PamService, MarketSuspensionService, CompetitionSuspensionService, OddsEngineClient],
})
export class PamModule {}

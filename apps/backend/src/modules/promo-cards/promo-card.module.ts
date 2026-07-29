import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { BetAndGetModule } from '../bet-and-get/bet-and-get.module';
import { DepositCampaignModule } from '../deposit-campaigns/deposit-campaign.module';
import { LeaderboardModule } from '../leaderboards/leaderboard.module';
import { MarginsModule } from '../margins/margins.module';
import { RegisterCampaignModule } from '../register-campaigns/register-campaign.module';
import { PromoCardAdminController } from './promo-card-admin.controller';
import { PromoCardService } from './promo-card.service';
import { PublicPromoCardController } from './public-promo-card.controller';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    BetAndGetModule,
    DepositCampaignModule,
    RegisterCampaignModule,
    LeaderboardModule,
    MarginsModule,
  ],
  controllers: [PromoCardAdminController, PublicPromoCardController],
  providers: [PromoCardService],
  exports: [PromoCardService],
})
export class PromoCardModule {}

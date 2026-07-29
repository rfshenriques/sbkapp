import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { FreebetModule } from '../freebets/freebet.module';
import { MarginsModule } from '../margins/margins.module';
import { PromoCardAutoSyncModule } from '../promo-cards/promo-card-auto-sync.module';
import { LeaderboardAdminController } from './leaderboard-admin.controller';
import { LeaderboardCampaignService } from './leaderboard-campaign.service';
import { LeaderboardPublicController } from './leaderboard-public.controller';
import { LeaderboardController } from './leaderboard.controller';

@Module({
  imports: [AdminModule, AuthModule, MarginsModule, PromoCardAutoSyncModule, FreebetModule],
  controllers: [LeaderboardAdminController, LeaderboardPublicController, LeaderboardController],
  providers: [LeaderboardCampaignService],
  exports: [LeaderboardCampaignService],
})
export class LeaderboardModule {}

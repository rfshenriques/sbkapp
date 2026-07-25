import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { FreebetModule } from '../freebets/freebet.module';
import { PlayerSegmentModule } from '../player-segments/player-segment.module';
import { DepositCampaignAdminController } from './deposit-campaign-admin.controller';
import { DepositCampaignService } from './deposit-campaign.service';
import { DepositController } from './deposit.controller';
import { DepositService } from './deposit.service';
import { PublicDepositCampaignController } from './public-deposit-campaign.controller';

@Module({
  imports: [AdminModule, AuthModule, FreebetModule, PlayerSegmentModule],
  controllers: [DepositCampaignAdminController, DepositController, PublicDepositCampaignController],
  providers: [DepositCampaignService, DepositService],
  exports: [DepositCampaignService, DepositService],
})
export class DepositCampaignModule {}

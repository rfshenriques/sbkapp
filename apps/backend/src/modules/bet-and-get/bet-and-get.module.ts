import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { MarginsModule } from '../margins/margins.module';
import { BetAndGetAdminController } from './bet-and-get-admin.controller';
import { BetAndGetCampaignService } from './bet-and-get-campaign.service';
import { BetAndGetPublicController } from './bet-and-get-public.controller';

@Module({
  imports: [AdminModule, MarginsModule],
  controllers: [BetAndGetAdminController, BetAndGetPublicController],
  providers: [BetAndGetCampaignService],
  exports: [BetAndGetCampaignService],
})
export class BetAndGetModule {}

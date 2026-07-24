import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BetAndGetCampaignService } from './bet-and-get-campaign.service';

@Module({
  imports: [AdminModule],
  providers: [BetAndGetCampaignService],
  exports: [BetAndGetCampaignService],
})
export class BetAndGetModule {}

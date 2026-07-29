import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PromoCardAutoSyncModule } from '../promo-cards/promo-card-auto-sync.module';
import { RegisterCampaignAdminController } from './register-campaign-admin.controller';
import { RegisterCampaignPublicController } from './register-campaign-public.controller';
import { RegisterCampaignService } from './register-campaign.service';

@Module({
  imports: [AdminModule, PromoCardAutoSyncModule],
  controllers: [RegisterCampaignAdminController, RegisterCampaignPublicController],
  providers: [RegisterCampaignService],
  exports: [RegisterCampaignService],
})
export class RegisterCampaignModule {}

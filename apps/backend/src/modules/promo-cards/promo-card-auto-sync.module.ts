import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PromoCardAutoSyncService } from './promo-card-auto-sync.service';

/**
 * Split out from PromoCardModule specifically so BetAndGetModule and
 * DepositCampaignModule can import it without a module cycle - see
 * PromoCardAutoSyncService's own doc comment for why.
 */
@Module({
  imports: [AdminModule],
  providers: [PromoCardAutoSyncService],
  exports: [PromoCardAutoSyncService],
})
export class PromoCardAutoSyncModule {}

import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ManualMarketAdminController } from './manual-market-admin.controller';
import { ManualMarketService } from './manual-market.service';

@Module({
  imports: [AdminModule],
  controllers: [ManualMarketAdminController],
  providers: [ManualMarketService],
  exports: [ManualMarketService],
})
export class ManualMarketModule {}

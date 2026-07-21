import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { MarketingSpendController } from './marketing-spend.controller';
import { MarketingSpendService } from './marketing-spend.service';

@Module({
  imports: [AdminModule],
  controllers: [MarketingSpendController],
  providers: [MarketingSpendService],
  exports: [MarketingSpendService],
})
export class MarketingSpendModule {}

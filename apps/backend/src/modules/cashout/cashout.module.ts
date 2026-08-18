import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { CashoutAdminController } from './cashout-admin.controller';
import { CashoutService } from './cashout.service';
import { PublicCashoutConfigController } from './public-cashout-config.controller';

@Module({
  imports: [AdminModule],
  controllers: [CashoutAdminController, PublicCashoutConfigController],
  providers: [CashoutService],
  exports: [CashoutService],
})
export class CashoutModule {}

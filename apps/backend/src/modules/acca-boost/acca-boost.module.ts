import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AccaBoostAdminController } from './acca-boost-admin.controller';
import { AccaBoostService } from './acca-boost.service';
import { PublicAccaBoostController } from './public-acca-boost.controller';

@Module({
  imports: [AdminModule],
  controllers: [AccaBoostAdminController, PublicAccaBoostController],
  providers: [AccaBoostService],
  exports: [AccaBoostService],
})
export class AccaBoostModule {}

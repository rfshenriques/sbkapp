import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { StakeLimitAdminController } from './stake-limit-admin.controller';
import { StakeLimitService } from './stake-limit.service';

@Module({
  imports: [AdminModule],
  controllers: [StakeLimitAdminController],
  providers: [StakeLimitService],
  exports: [StakeLimitService],
})
export class LimitsModule {}

import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AccaRollbackAdminController } from './acca-rollback-admin.controller';
import { AccaRollbackService } from './acca-rollback.service';
import { PublicAccaRollbackController } from './public-acca-rollback.controller';

@Module({
  imports: [AdminModule],
  controllers: [AccaRollbackAdminController, PublicAccaRollbackController],
  providers: [AccaRollbackService],
  exports: [AccaRollbackService],
})
export class AccaRollbackModule {}

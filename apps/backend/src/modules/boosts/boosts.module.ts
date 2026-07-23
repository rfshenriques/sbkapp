import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BoostAdminController } from './boost-admin.controller';
import { BoostService } from './boost.service';
import { OddsLadderAdminController } from './odds-ladder-admin.controller';
import { OddsLadderService } from './odds-ladder.service';

@Module({
  imports: [AdminModule],
  controllers: [OddsLadderAdminController, BoostAdminController],
  providers: [OddsLadderService, BoostService],
  exports: [BoostService],
})
export class BoostsModule {}

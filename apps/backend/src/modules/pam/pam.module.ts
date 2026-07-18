import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { MarketAdminController } from './market-admin.controller';
import { MarketSuspensionService } from './market-suspension.service';
import { PamAdminController } from './pam-admin.controller';
import { PamController } from './pam.controller';
import { PamService } from './pam.service';

@Module({
  imports: [AdminModule],
  controllers: [PamController, PamAdminController, MarketAdminController],
  providers: [PamService, MarketSuspensionService],
})
export class PamModule {}

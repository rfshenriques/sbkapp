import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { OddsOverrideAdminController } from './odds-override-admin.controller';
import { OddsOverrideService } from './odds-override.service';

@Module({
  imports: [AdminModule],
  controllers: [OddsOverrideAdminController],
  providers: [OddsOverrideService],
  exports: [OddsOverrideService],
})
export class OddsOverrideModule {}

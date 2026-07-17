import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PamAdminController } from './pam-admin.controller';
import { PamController } from './pam.controller';
import { PamService } from './pam.service';

@Module({
  imports: [AdminModule],
  controllers: [PamController, PamAdminController],
  providers: [PamService],
})
export class PamModule {}

import { Module } from '@nestjs/common';
import { PamAdminController } from './pam-admin.controller';
import { PamController } from './pam.controller';
import { PamService } from './pam.service';

@Module({
  controllers: [PamController, PamAdminController],
  providers: [PamService],
})
export class PamModule {}

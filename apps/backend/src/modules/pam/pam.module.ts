import { Module } from '@nestjs/common';
import { PamController } from './pam.controller';
import { PamService } from './pam.service';

@Module({
  controllers: [PamController],
  providers: [PamService],
})
export class PamModule {}

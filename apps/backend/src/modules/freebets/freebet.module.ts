import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { FreebetController } from './freebet.controller';
import { FreebetService } from './freebet.service';

@Module({
  imports: [AdminModule],
  controllers: [FreebetController],
  providers: [FreebetService],
  exports: [FreebetService],
})
export class FreebetModule {}

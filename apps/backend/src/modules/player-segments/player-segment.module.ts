import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PlayerSegmentController } from './player-segment.controller';
import { PlayerSegmentService } from './player-segment.service';

@Module({
  imports: [AdminModule],
  controllers: [PlayerSegmentController],
  providers: [PlayerSegmentService],
  exports: [PlayerSegmentService],
})
export class PlayerSegmentModule {}

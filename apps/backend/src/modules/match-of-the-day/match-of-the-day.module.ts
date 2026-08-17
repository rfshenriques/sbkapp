import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { MatchOfTheDayAdminController } from './match-of-the-day-admin.controller';
import { MatchOfTheDayService } from './match-of-the-day.service';
import { PublicMatchOfTheDayController } from './public-match-of-the-day.controller';

@Module({
  imports: [AdminModule],
  controllers: [MatchOfTheDayAdminController, PublicMatchOfTheDayController],
  providers: [MatchOfTheDayService],
  exports: [MatchOfTheDayService],
})
export class MatchOfTheDayModule {}

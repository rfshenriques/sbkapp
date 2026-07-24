import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { CompetitionQuicklinkController } from './competition-quicklink.controller';
import { CompetitionQuicklinkService } from './competition-quicklink.service';
import { PublicCompetitionQuicklinkController } from './public-competition-quicklink.controller';

@Module({
  imports: [AdminModule],
  controllers: [CompetitionQuicklinkController, PublicCompetitionQuicklinkController],
  providers: [CompetitionQuicklinkService],
})
export class CompetitionQuicklinkModule {}

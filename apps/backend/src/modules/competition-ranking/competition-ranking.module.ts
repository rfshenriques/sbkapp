import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { CompetitionRankingController } from './competition-ranking.controller';
import { CompetitionRankingService } from './competition-ranking.service';
import { PublicCompetitionRankingController } from './public-competition-ranking.controller';

@Module({
  imports: [AdminModule],
  controllers: [CompetitionRankingController, PublicCompetitionRankingController],
  providers: [CompetitionRankingService],
})
export class CompetitionRankingModule {}

import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PublicTeamColorsController } from './public-team-colors.controller';
import { TeamColorsController } from './team-colors.controller';
import { TeamColorsService } from './team-colors.service';

@Module({
  imports: [AdminModule],
  controllers: [TeamColorsController, PublicTeamColorsController],
  providers: [TeamColorsService],
})
export class TeamColorsModule {}

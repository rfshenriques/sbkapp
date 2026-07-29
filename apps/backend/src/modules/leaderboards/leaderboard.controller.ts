import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { LeaderboardCampaignService } from './leaderboard-campaign.service';

interface AuthenticatedRequest {
  user: JwtPayload;
}

/** Player-authenticated actions - opting into a leaderboard and checking your own entry. Distinct from leaderboard-public.controller.ts, which never requires login. */
@UseGuards(JwtAuthGuard)
@Controller('leaderboard-campaigns')
export class LeaderboardController {
  constructor(private readonly leaderboardCampaignService: LeaderboardCampaignService) {}

  @Post(':id/join')
  join(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leaderboardCampaignService.join(req.user.brandId, id, req.user.sub);
  }

  @Get(':id/my-entry')
  getMyEntry(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leaderboardCampaignService.getEntryForUser(id, req.user.sub);
  }
}

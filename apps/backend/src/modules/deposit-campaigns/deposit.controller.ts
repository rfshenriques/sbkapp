import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PlayerSegmentService } from '../player-segments/player-segment.service';
import { DepositCampaignService } from './deposit-campaign.service';
import { DepositService } from './deposit.service';
import { RecordDepositDto } from './dto/record-deposit.dto';

interface AuthenticatedRequest {
  user: JwtPayload;
}

/**
 * Player-facing deposit endpoints - a real self-serve top-up (paper money,
 * same simulation as the rest of the platform's balance), and the lookup
 * the login flow uses to decide whether to show the deposit campaign modal
 * right after a player logs in.
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class DepositController {
  constructor(
    private readonly depositService: DepositService,
    private readonly depositCampaignService: DepositCampaignService,
    private readonly playerSegmentService: PlayerSegmentService,
  ) {}

  @Post('deposits')
  deposit(@Req() req: AuthenticatedRequest, @Body() dto: RecordDepositDto) {
    return this.depositService.recordDeposit(req.user.sub, dto.amountCents);
  }

  /** The first enabled deposit campaign this player is targeted by and can still redeem, or null - what the post-login modal (and a re-opened promo card) render. */
  @Get('deposit-campaigns/eligible')
  async eligibleCampaign(@Req() req: AuthenticatedRequest) {
    const segmentIds = await this.playerSegmentService.resolveSegmentIdsForUser(req.user.sub);
    return this.depositCampaignService.resolveEligibleForPlayer(req.user.brandId, req.user.sub, {
      isLoggedIn: true,
      segmentIds,
    });
  }
}

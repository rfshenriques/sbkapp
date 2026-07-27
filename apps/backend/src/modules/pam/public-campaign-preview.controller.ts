import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { OptionalPlayerAuthService } from '../auth/optional-player-auth.service';
import { PreviewCampaignDto } from './dto/preview-campaign.dto';
import { PamService } from './pam.service';

/**
 * Unauthenticated, player-facing - lets the bet slip show "you'll qualify
 * for X" before the player places the bet (see PamService.previewCampaign
 * and PamService.placeBet's own resolution, which this mirrors). Soft auth
 * (same as stake-limit-preview): a missing/invalid token still gets a Bet &
 * Get preview (scope/condition matching doesn't need a player), just
 * without a canRedeem check or any deposit-campaign preview, since deposit
 * campaign redemptions are always tied to a specific logged-in player.
 */
@Controller('public/campaign-preview')
export class PublicCampaignPreviewController {
  constructor(
    private readonly pamService: PamService,
    private readonly optionalPlayerAuthService: OptionalPlayerAuthService,
  ) {}

  @Post(':brandId')
  async preview(
    @Param('brandId') brandId: string,
    @Body() dto: PreviewCampaignDto,
    @Headers('authorization') authorization?: string,
  ) {
    const payload = await this.optionalPlayerAuthService.resolve(authorization);
    return this.pamService.previewCampaign(
      payload?.sub ?? null,
      brandId,
      dto.selections,
      dto.stakeCents,
      dto.insuranceOptIn,
      dto.useFreebets,
    );
  }
}

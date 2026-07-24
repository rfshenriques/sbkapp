import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { OptionalPlayerAuthService } from '../auth/optional-player-auth.service';
import { PreviewStakeLimitDto } from './dto/preview-stake-limit.dto';
import { PamService } from './pam.service';

/**
 * Unauthenticated, player-facing - lets the bet slip warn a player before
 * they try to place a bet that PamService.placeBet would just reject for
 * exceeding a StakeLimit. Soft auth (same as matches/specials/boosts): a
 * missing/invalid token still gets a preview, just without any
 * PLAYER-scoped override, same as browsing logged out.
 */
@Controller('public/stake-limit-preview')
export class PublicStakeLimitPreviewController {
  constructor(
    private readonly pamService: PamService,
    private readonly optionalPlayerAuthService: OptionalPlayerAuthService,
  ) {}

  @Post(':brandId')
  async preview(
    @Param('brandId') brandId: string,
    @Body() dto: PreviewStakeLimitDto,
    @Headers('authorization') authorization?: string,
  ) {
    const payload = await this.optionalPlayerAuthService.resolve(authorization);
    return this.pamService.previewStakeLimit(payload?.sub ?? null, brandId, dto.selections);
  }
}

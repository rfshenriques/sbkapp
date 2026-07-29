import { Controller, Get, Param } from '@nestjs/common';
import { RegisterCampaignService } from './register-campaign.service';

/**
 * Unauthenticated, player-facing - backs a "sign up & get X" register-page
 * banner and a register-linked promo card's click-through. Only ever
 * surfaces enabled campaigns - a disabled one is a draft, not a "closed"
 * promo, so it's simply invisible here. Eligibility (audience, already
 * redeemed) is re-checked server-side at registration itself (see
 * AuthService.register), not here.
 */
@Controller('public/register-campaigns')
export class RegisterCampaignPublicController {
  constructor(private readonly registerCampaignService: RegisterCampaignService) {}

  @Get(':brandId')
  list(@Param('brandId') brandId: string) {
    return this.registerCampaignService.listEnabled(brandId);
  }
}

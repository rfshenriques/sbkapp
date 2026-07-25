import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { DepositCampaignService } from './deposit-campaign.service';

/**
 * Unauthenticated, player-facing - backs a deposit-linked promo card's
 * click-through (apps/frontend reopens the deposit campaign modal with
 * this data). Only ever surfaces enabled campaigns - a disabled one is a
 * draft, not a "closed" promo, so it's simply invisible here. Whether the
 * viewer can actually still redeem it is re-checked server-side when they
 * submit a deposit (see DepositService), not here.
 */
@Controller('public/deposit-campaigns')
export class PublicDepositCampaignController {
  constructor(private readonly depositCampaignService: DepositCampaignService) {}

  @Get(':brandId/:id')
  async get(@Param('brandId') brandId: string, @Param('id') id: string) {
    const campaigns = await this.depositCampaignService.listEnabled(brandId);
    const campaign = campaigns.find((entry) => entry.id === id);
    if (!campaign) {
      throw new NotFoundException('Deposit campaign not found');
    }
    return campaign;
  }
}

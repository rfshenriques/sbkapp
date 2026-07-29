import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { campaignPromoStatus } from './promo-card-status';

interface BetAndGetCampaignForSync {
  id: string;
  name: string;
  enabled: boolean;
  startAt: Date | null;
  endAt: Date | null;
  rewardType: 'FIXED' | 'PERCENTAGE';
  rewardAmountCents: number | null;
  rewardPercent: number | null;
  rewardCapCents: number | null;
}

interface DepositCampaignForSync {
  id: string;
  name: string;
  enabled: boolean;
  startAt: Date | null;
  endAt: Date | null;
  rewardType: 'FIXED' | 'PERCENTAGE';
  fixedRewardAmountCents: number | null;
  rewardPercent: number | null;
  rewardCapCents: number | null;
}

interface RegisterCampaignForSync {
  id: string;
  name: string;
  enabled: boolean;
  startAt: Date | null;
  endAt: Date | null;
  rewardType: 'FIXED' | 'PERCENTAGE';
  rewardAmountCents: number | null;
  rewardPercent: number | null;
  rewardCapCents: number | null;
}

interface LeaderboardCampaignForSync {
  id: string;
  name: string;
  enabled: boolean;
  startAt: Date | null;
  endAt: Date;
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Auto-creates a no-image PromoCard for a campaign the moment it goes live,
 * if staff haven't already made one (auto or manual) - so a newly-enabled
 * campaign is always discoverable on the Challenges page without a CMS step
 * being a prerequisite. Deliberately its own tiny module (just Prisma +
 * audit log, nothing else) rather than living on PromoCardService, which
 * already depends on BetAndGetModule/DepositCampaignModule for unrelated
 * reasons (ownership checks, redemption filtering) - the campaign modules
 * calling back into that same service to trigger this would be a module
 * cycle. Nothing here ever disables/deletes a card: a campaign going off,
 * unscheduled, or past its endAt is entirely reflected by
 * campaignPromoStatus computing a different status live off the still-
 * intact row (see PromoCardService.listForViewer) - only campaign deletion
 * removes the card, via the cascading FK in schema.prisma.
 */
@Injectable()
export class PromoCardAutoSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async ensureCard(
    brandId: string,
    existingWhere:
      | { betAndGetCampaignId: string }
      | { depositCampaignId: string }
      | { registerCampaignId: string }
      | { leaderboardCampaignId: string },
    title: string,
    subtitle: string,
    actor: AuditActor,
  ) {
    const existing = await this.prisma.promoCard.findFirst({ where: existingWhere });
    if (existing) {
      return;
    }

    const highest = await this.prisma.promoCard.findFirst({
      where: { brandId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const card = await this.prisma.promoCard.create({
      data: {
        brandId,
        data: null,
        mimeType: null,
        title,
        subtitle,
        autoCreated: true,
        sortOrder: (highest?.sortOrder ?? -1) + 1,
        ...existingWhere,
      },
    });

    await this.auditLogService.record({
      actor,
      action: 'PROMO_CARD_ADDED',
      targetType: 'PromoCard',
      targetId: card.id,
      metadata: { title: card.title, autoCreated: true },
    });
  }

  async ensureForBetAndGetCampaign(brandId: string, campaign: BetAndGetCampaignForSync, actor: AuditActor) {
    if (campaignPromoStatus(campaign) !== 'ACTIVE') {
      return;
    }
    const subtitle =
      campaign.rewardType === 'FIXED'
        ? `Bet & get ${formatCents(campaign.rewardAmountCents ?? 0)} €`
        : `Get ${campaign.rewardPercent}% of your stake back, up to ${formatCents(campaign.rewardCapCents ?? 0)} €`;
    await this.ensureCard(brandId, { betAndGetCampaignId: campaign.id }, campaign.name, subtitle, actor);
  }

  async ensureForDepositCampaign(brandId: string, campaign: DepositCampaignForSync, actor: AuditActor) {
    if (campaignPromoStatus(campaign) !== 'ACTIVE') {
      return;
    }
    const subtitle =
      campaign.rewardType === 'FIXED'
        ? `Deposit & get ${formatCents(campaign.fixedRewardAmountCents ?? 0)} €`
        : `Get ${campaign.rewardPercent}% back, up to ${formatCents(campaign.rewardCapCents ?? 0)} €`;
    await this.ensureCard(brandId, { depositCampaignId: campaign.id }, campaign.name, subtitle, actor);
  }

  async ensureForRegisterCampaign(brandId: string, campaign: RegisterCampaignForSync, actor: AuditActor) {
    if (campaignPromoStatus(campaign) !== 'ACTIVE') {
      return;
    }
    const subtitle =
      campaign.rewardType === 'FIXED'
        ? `Sign up & get ${formatCents(campaign.rewardAmountCents ?? 0)} €`
        : `Get ${campaign.rewardPercent}% of your first bet back, up to ${formatCents(campaign.rewardCapCents ?? 0)} €`;
    await this.ensureCard(brandId, { registerCampaignId: campaign.id }, campaign.name, subtitle, actor);
  }

  async ensureForLeaderboardCampaign(brandId: string, campaign: LeaderboardCampaignForSync, actor: AuditActor) {
    if (campaignPromoStatus(campaign) !== 'ACTIVE') {
      return;
    }
    await this.ensureCard(brandId, { leaderboardCampaignId: campaign.id }, campaign.name, 'Join the leaderboard', actor);
  }
}

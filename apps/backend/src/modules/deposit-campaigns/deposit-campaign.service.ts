import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AudienceMode, BetAndGetBetType, BetAndGetTrigger, DepositRewardType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { resolveAudience, type AudienceViewer } from '../audience/audience';
import { betQualifiesForCampaign, isCampaignScheduledActive, type QualifyingBetInput } from '../bet-and-get/bet-and-get';

export interface DepositCampaignInput {
  name: string;
  description?: string;
  startAt?: Date | null;
  endAt?: Date | null;
  minDepositAmountCents: number;
  rewardType: DepositRewardType;
  fixedRewardAmountCents?: number | null;
  rewardPercent?: number | null;
  rewardCapCents?: number | null;
  requiresBet?: boolean;
  trigger?: BetAndGetTrigger;
  triggerOnWon?: boolean;
  triggerOnLost?: boolean;
  triggerOnVoid?: boolean;
  minStakeCents?: number | null;
  minOddsPerLeg?: number | null;
  betType?: BetAndGetBetType;
  minSelections?: number | null;
  allowMultipleRedemptions?: boolean;
  maxRedemptionsPerPlayer?: number | null;
  audienceMode?: AudienceMode;
  segmentIds?: string[];
}

export type UpdateDepositCampaignInput = Partial<DepositCampaignInput> & { enabled?: boolean };

const campaignInclude = { segments: true } as const;

/** Rejects a reward configuration that doesn't match its own rewardType - checked here rather than in the DTO since it depends on more than one field. */
function assertRewardConfigValid(input: { rewardType: DepositRewardType; fixedRewardAmountCents?: number | null; rewardPercent?: number | null; rewardCapCents?: number | null }) {
  if (input.rewardType === 'FIXED' && !input.fixedRewardAmountCents) {
    throw new BadRequestException('fixedRewardAmountCents is required when rewardType is FIXED');
  }
  if (input.rewardType === 'PERCENTAGE' && (!input.rewardPercent || !input.rewardCapCents)) {
    throw new BadRequestException('rewardPercent and rewardCapCents are required when rewardType is PERCENTAGE');
  }
}

/**
 * Deposit-triggered campaigns - see DepositCampaign in schema.prisma for the
 * model shape. Unlike BetAndGetCampaign (resolved from live match/odds
 * data), eligibility here is driven by audience targeting + the player's
 * own redemption history (see DepositService and PamService for where a
 * qualifying deposit/bet actually turns into a DepositCampaignRedemption).
 */
@Injectable()
export class DepositCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(brandId: string) {
    return this.prisma.depositCampaign.findMany({
      where: { brandId },
      include: campaignInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Enabled AND currently within their scheduling window (if any), oldest first - what deposit evaluation and the promo-card/modal eligibility checks iterate over. */
  async listEnabled(brandId: string) {
    const now = new Date();
    return this.prisma.depositCampaign.findMany({
      where: {
        brandId,
        enabled: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: campaignInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  private async findOwned(brandId: string, id: string) {
    const campaign = await this.prisma.depositCampaign.findUnique({
      where: { id },
      include: campaignInclude,
    });
    if (!campaign || campaign.brandId !== brandId) {
      throw new NotFoundException('Deposit campaign not found');
    }
    return campaign;
  }

  async get(brandId: string, id: string) {
    return this.findOwned(brandId, id);
  }

  async create(brandId: string, input: DepositCampaignInput, actor: AuditActor) {
    assertRewardConfigValid(input);

    const campaign = await this.prisma.depositCampaign.create({
      data: {
        brandId,
        name: input.name,
        description: input.description,
        startAt: input.startAt ?? null,
        endAt: input.endAt ?? null,
        minDepositAmountCents: input.minDepositAmountCents,
        rewardType: input.rewardType,
        fixedRewardAmountCents: input.fixedRewardAmountCents ?? null,
        rewardPercent: input.rewardPercent ?? null,
        rewardCapCents: input.rewardCapCents ?? null,
        requiresBet: input.requiresBet ?? false,
        trigger: input.trigger ?? 'PLACEMENT',
        triggerOnWon: input.triggerOnWon ?? false,
        triggerOnLost: input.triggerOnLost ?? false,
        triggerOnVoid: input.triggerOnVoid ?? false,
        minStakeCents: input.minStakeCents ?? null,
        minOddsPerLeg: input.minOddsPerLeg ?? null,
        betType: input.betType ?? 'EITHER',
        minSelections: input.minSelections ?? null,
        allowMultipleRedemptions: input.allowMultipleRedemptions ?? false,
        maxRedemptionsPerPlayer: input.maxRedemptionsPerPlayer ?? null,
        audienceMode: input.audienceMode ?? 'ALL',
        segments: input.segmentIds ? { create: input.segmentIds.map((segmentId) => ({ segmentId })) } : undefined,
      },
      include: campaignInclude,
    });

    await this.auditLogService.record({
      actor,
      action: 'DEPOSIT_CAMPAIGN_CREATED',
      targetType: 'DepositCampaign',
      targetId: campaign.id,
      metadata: { name: campaign.name },
    });

    return campaign;
  }

  async update(brandId: string, id: string, input: UpdateDepositCampaignInput, actor: AuditActor) {
    const existing = await this.findOwned(brandId, id);
    assertRewardConfigValid({
      rewardType: input.rewardType ?? existing.rewardType,
      fixedRewardAmountCents: input.fixedRewardAmountCents ?? existing.fixedRewardAmountCents,
      rewardPercent: input.rewardPercent ?? existing.rewardPercent,
      rewardCapCents: input.rewardCapCents ?? existing.rewardCapCents,
    });

    const { segmentIds, ...rest } = input;

    const campaign = await this.prisma.depositCampaign.update({
      where: { id },
      data: {
        ...rest,
        ...(segmentIds !== undefined
          ? { segments: { deleteMany: {}, create: segmentIds.map((segmentId) => ({ segmentId })) } }
          : {}),
      },
      include: campaignInclude,
    });

    await this.auditLogService.record({
      actor,
      action: 'DEPOSIT_CAMPAIGN_UPDATED',
      targetType: 'DepositCampaign',
      targetId: campaign.id,
      metadata: { name: campaign.name },
    });

    return campaign;
  }

  async remove(brandId: string, id: string, actor: AuditActor) {
    await this.findOwned(brandId, id);
    await this.prisma.depositCampaign.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'DEPOSIT_CAMPAIGN_REMOVED',
      targetType: 'DepositCampaign',
      targetId: id,
    });
  }

  /** How many times this player has already consumed a redemption slot on this campaign - counts every DepositCampaignRedemption row regardless of status, since even a still-PENDING_BET one has already claimed a deposit's worth of eligibility. */
  async countRedemptions(campaignId: string, userId: string): Promise<number> {
    return this.prisma.depositCampaignRedemption.count({ where: { depositCampaignId: campaignId, userId } });
  }

  async canRedeem(
    campaign: { id: string; allowMultipleRedemptions: boolean; maxRedemptionsPerPlayer: number | null },
    userId: string,
  ): Promise<boolean> {
    if (!campaign.allowMultipleRedemptions) {
      return (await this.countRedemptions(campaign.id, userId)) === 0;
    }
    if (campaign.maxRedemptionsPerPlayer === null) {
      return true;
    }
    return (await this.countRedemptions(campaign.id, userId)) < campaign.maxRedemptionsPerPlayer;
  }

  /** Whether this player has already been granted this campaign's reward at least once - what card/modal visibility filters on ("already got the reward"), distinct from canRedeem which also blocks on a still-pending redemption. */
  async hasBeenGranted(campaignId: string, userId: string): Promise<boolean> {
    return (
      (await this.prisma.freebetGrant.count({
        where: { source: 'DEPOSIT_CAMPAIGN', sourceCampaignId: campaignId, userId },
      })) > 0
    );
  }

  /**
   * The oldest PENDING_BET redemption (if any) this bet's stake/odds
   * satisfy its own campaign's bet-requirement conditions - mirrors
   * BetAndGetCampaignService.resolveApplicableCampaign, just matched
   * against a redemption that already exists (created at deposit time)
   * instead of resolved fresh from scope. Only an enabled campaign's
   * redemption can be matched, so disabling a campaign after a qualifying
   * deposit but before the bet just leaves that deposit's redemption
   * stuck pending rather than fulfilling it.
   */
  async resolvePendingBetRedemption(userId: string, bet: QualifyingBetInput) {
    const pending = await this.prisma.depositCampaignRedemption.findMany({
      where: { userId, status: 'PENDING_BET' },
      orderBy: { createdAt: 'asc' },
      include: { depositCampaign: true },
    });
    return (
      pending.find(
        (redemption) =>
          isCampaignScheduledActive(redemption.depositCampaign) &&
          betQualifiesForCampaign(redemption.depositCampaign, bet),
      ) ?? null
    );
  }

  /** The first enabled campaign (oldest first) this viewer is both targeted by and still eligible to redeem - what the post-login modal and promo-card filtering both resolve against. */
  async resolveEligibleForPlayer(brandId: string, userId: string, viewer: AudienceViewer) {
    const campaigns = await this.listEnabled(brandId);
    for (const campaign of campaigns) {
      const inAudience = resolveAudience(
        campaign.audienceMode,
        campaign.segments.map((segment) => segment.segmentId),
        viewer,
      );
      if (inAudience && (await this.canRedeem(campaign, userId))) {
        return campaign;
      }
    }
    return null;
  }
}

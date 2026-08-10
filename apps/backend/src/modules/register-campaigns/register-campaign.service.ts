import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AudienceMode, BetAndGetBetType, BetAndGetRewardType, BetAndGetTrigger } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { resolveAudience, type AudienceViewer } from '../audience/audience';
import { betQualifiesForCampaign, isCampaignScheduledActive, type QualifyingBetInput } from '../bet-and-get/bet-and-get';
import { isWithinQualifyingBetWindow } from './register-campaign';

export interface RegisterCampaignInput {
  name: string;
  description?: string;
  startAt?: Date | null;
  endAt?: Date | null;
  rewardType?: BetAndGetRewardType;
  /** Required when rewardType is FIXED. */
  rewardAmountCents?: number | null;
  /** Required when rewardType is PERCENTAGE - only valid alongside requiresBet, since there's no bet stake to take a percentage of otherwise. */
  rewardPercent?: number | null;
  rewardCapCents?: number | null;
  requiresBet?: boolean;
  /** Required when requiresBet is true. */
  qualifyingBetWindowDays?: number | null;
  trigger?: BetAndGetTrigger;
  triggerOnWon?: boolean;
  triggerOnLost?: boolean;
  triggerOnVoid?: boolean;
  minStakeCents?: number | null;
  minOddsPerLeg?: number | null;
  betType?: BetAndGetBetType;
  minSelections?: number | null;
  audienceMode?: AudienceMode;
  segmentIds?: string[];
}

export type UpdateRegisterCampaignInput = Partial<RegisterCampaignInput> & { enabled?: boolean };

const campaignInclude = { segments: true } as const;

/** Rejects a reward/bet-requirement configuration that doesn't match its own flags - checked here rather than in the DTO since it depends on more than one field, same convention as Deposit/BetAndGet campaign validation. */
function assertConfigValid(input: {
  rewardType: BetAndGetRewardType;
  rewardAmountCents?: number | null;
  rewardPercent?: number | null;
  rewardCapCents?: number | null;
  requiresBet: boolean;
  qualifyingBetWindowDays?: number | null;
}) {
  if (input.rewardType === 'FIXED' && !input.rewardAmountCents) {
    throw new BadRequestException('rewardAmountCents is required when rewardType is FIXED');
  }
  if (input.rewardType === 'PERCENTAGE') {
    if (!input.requiresBet) {
      throw new BadRequestException('rewardType PERCENTAGE requires requiresBet - there is no bet stake to take a percentage of otherwise');
    }
    if (!input.rewardPercent || !input.rewardCapCents) {
      throw new BadRequestException('rewardPercent and rewardCapCents are required when rewardType is PERCENTAGE');
    }
  }
  if (input.requiresBet && !input.qualifyingBetWindowDays) {
    throw new BadRequestException('qualifyingBetWindowDays is required when requiresBet is true');
  }
}

/**
 * Welcome-bonus campaigns for new players - see RegisterCampaign in
 * schema.prisma for the model shape. Brand-wide, never match-scoped (unlike
 * BetAndGetCampaign) since signing up isn't tied to any particular bet's
 * matches. requiresBet mirrors DepositCampaign.requiresBet: false grants
 * the reward the instant registration completes (see AuthService.register);
 * true defers the grant to a qualifying bet placed within
 * qualifyingBetWindowDays of the player's own signup (see PamService).
 */
@Injectable()
export class RegisterCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(brandId: string) {
    return this.prisma.registerCampaign.findMany({
      where: { brandId },
      include: campaignInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Enabled AND currently within their scheduling window (if any), oldest first - what registration evaluation iterates over. */
  async listEnabled(brandId: string) {
    const now = new Date();
    return this.prisma.registerCampaign.findMany({
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
    const campaign = await this.prisma.registerCampaign.findUnique({
      where: { id },
      include: campaignInclude,
    });
    if (!campaign || campaign.brandId !== brandId) {
      throw new NotFoundException('Register campaign not found');
    }
    return campaign;
  }

  async get(brandId: string, id: string) {
    return this.findOwned(brandId, id);
  }

  async create(brandId: string, input: RegisterCampaignInput, actor: AuditActor) {
    const rewardType = input.rewardType ?? 'FIXED';
    const requiresBet = input.requiresBet ?? false;
    assertConfigValid({ ...input, rewardType, requiresBet });

    const campaign = await this.prisma.registerCampaign.create({
      data: {
        brandId,
        name: input.name,
        description: input.description,
        startAt: input.startAt ?? null,
        endAt: input.endAt ?? null,
        rewardType,
        rewardAmountCents: input.rewardAmountCents ?? null,
        rewardPercent: input.rewardPercent ?? null,
        rewardCapCents: input.rewardCapCents ?? null,
        requiresBet,
        qualifyingBetWindowDays: input.qualifyingBetWindowDays ?? null,
        trigger: input.trigger ?? 'PLACEMENT',
        triggerOnWon: input.triggerOnWon ?? false,
        triggerOnLost: input.triggerOnLost ?? false,
        triggerOnVoid: input.triggerOnVoid ?? false,
        minStakeCents: input.minStakeCents ?? null,
        minOddsPerLeg: input.minOddsPerLeg ?? null,
        betType: input.betType ?? 'EITHER',
        minSelections: input.minSelections ?? null,
        audienceMode: input.audienceMode ?? 'ALL',
        segments: input.segmentIds ? { create: input.segmentIds.map((segmentId) => ({ segmentId })) } : undefined,
      },
      include: campaignInclude,
    });

    await this.auditLogService.record({
      actor,
      action: 'REGISTER_CAMPAIGN_CREATED',
      targetType: 'RegisterCampaign',
      targetId: campaign.id,
      metadata: { name: campaign.name },
    });

    return campaign;
  }

  async update(brandId: string, id: string, input: UpdateRegisterCampaignInput, actor: AuditActor) {
    const existing = await this.findOwned(brandId, id);
    assertConfigValid({
      rewardType: input.rewardType ?? existing.rewardType,
      rewardAmountCents: input.rewardAmountCents ?? existing.rewardAmountCents,
      rewardPercent: input.rewardPercent ?? existing.rewardPercent,
      rewardCapCents: input.rewardCapCents ?? existing.rewardCapCents,
      requiresBet: input.requiresBet ?? existing.requiresBet,
      qualifyingBetWindowDays: input.qualifyingBetWindowDays ?? existing.qualifyingBetWindowDays,
    });

    const { segmentIds, ...rest } = input;

    const campaign = await this.prisma.registerCampaign.update({
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
      action: 'REGISTER_CAMPAIGN_UPDATED',
      targetType: 'RegisterCampaign',
      targetId: campaign.id,
      metadata: { name: campaign.name },
    });

    return campaign;
  }

  async remove(brandId: string, id: string, actor: AuditActor) {
    await this.findOwned(brandId, id);
    await this.prisma.registerCampaign.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'REGISTER_CAMPAIGN_REMOVED',
      targetType: 'RegisterCampaign',
      targetId: id,
    });
  }

  /**
   * Whether this player can still redeem this campaign: no existing
   * redemption row (a simple existence check, unlike DepositCampaignService.
   * canRedeem's counted-redemptions logic, since registration is a one-time
   * event enforced by RegisterCampaignRedemption's own @@unique(
   * registerCampaignId, userId)) AND, when the campaign requires a
   * qualifying bet, the player's own signup is still inside the configured
   * day window.
   *
   * The window check matters even though AuthService.register already
   * creates a PENDING_BET redemption (and so a real existence-check hit)
   * for anyone eligible at signup time: a player whose account predates
   * this campaign's creation - or who was otherwise never granted an
   * initial redemption row - has no existing row to find, so a pure
   * existence check would read as "still eligible" forever even once their
   * personal window has closed.
   */
  async canRedeem(
    campaign: { id: string; requiresBet: boolean; qualifyingBetWindowDays: number | null },
    userId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.registerCampaignRedemption.findUnique({
      where: { registerCampaignId_userId: { registerCampaignId: campaign.id, userId } },
    });
    if (existing !== null) {
      return false;
    }
    if (!campaign.requiresBet) {
      return true;
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    if (!user) {
      return false;
    }
    return isWithinQualifyingBetWindow(user.createdAt, campaign.qualifyingBetWindowDays!);
  }

  /** The first enabled campaign (oldest first) this new signup is both targeted by and hasn't already redeemed - resolved at registration time (see AuthService.register). A brand-new user has no segments yet, so a SEGMENTS-mode campaign correctly never matches a fresh signup. */
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

  /**
   * The oldest PENDING_BET redemption (if any) this bet's stake/odds
   * satisfy its own campaign's bet-requirement conditions AND that still
   * falls within that campaign's qualifyingBetWindowDays of the player's
   * own signup - mirrors DepositCampaignService.resolvePendingBetRedemption,
   * with the added day-window gate.
   */
  async resolvePendingBetRedemption(userId: string, userCreatedAt: Date, bet: QualifyingBetInput) {
    const pending = await this.prisma.registerCampaignRedemption.findMany({
      where: { userId, status: 'PENDING_BET' },
      orderBy: { createdAt: 'asc' },
      include: { registerCampaign: true },
    });
    return (
      pending.find(({ registerCampaign }) => {
        if (!isCampaignScheduledActive(registerCampaign) || !betQualifiesForCampaign(registerCampaign, bet)) {
          return false;
        }
        return isWithinQualifyingBetWindow(userCreatedAt, registerCampaign.qualifyingBetWindowDays!);
      }) ?? null
    );
  }
}

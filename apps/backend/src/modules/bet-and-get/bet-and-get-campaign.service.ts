import { Injectable, NotFoundException } from '@nestjs/common';
import type { AudienceMode, BetAndGetBetType, BetAndGetScopeType, BetAndGetTiming, BetAndGetTrigger, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { betQualifiesForCampaign, matchIsInCampaignScope, matchTimingQualifies, type ScopeMatchInput } from './bet-and-get';

/** Same PrismaClientLike convention as FreebetService.grantSystem - lets a caller pass the active settlement transaction so the redemption count it reads is consistent with the grant it's about to write. */
type PrismaClientLike = PrismaService | Prisma.TransactionClient;

export interface CreateBetAndGetCampaignInput {
  name: string;
  description?: string;
  rewardAmountCents: number;
  startAt?: Date | null;
  endAt?: Date | null;
  trigger?: BetAndGetTrigger;
  triggerOnWon?: boolean;
  triggerOnLost?: boolean;
  triggerOnVoid?: boolean;
  minStakeCents?: number | null;
  minOddsPerLeg?: number | null;
  minCombinedOdds?: number | null;
  betType?: BetAndGetBetType;
  minSelections?: number | null;
  bettingTiming?: BetAndGetTiming;
  allowMultipleRedemptions?: boolean;
  maxRedemptionsPerPlayer?: number | null;
  audienceMode?: AudienceMode;
  segmentIds?: string[];
}

export type UpdateBetAndGetCampaignInput = Partial<CreateBetAndGetCampaignInput> & { enabled?: boolean };

export interface SetCampaignScopeInput {
  scopeType: BetAndGetScopeType;
  scopeValue: string;
}

const campaignInclude = { scopes: true, segments: true } as const;

/**
 * "Bet & Get" fixed-amount campaigns - see BetAndGetCampaign in
 * schema.prisma for the model shape. Campaign resolution (which one, if
 * any, a bet qualifies for) happens once at placement time in PamService
 * using live match/odds data, then is reused unchanged at settlement.
 */
@Injectable()
export class BetAndGetCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(brandId: string) {
    return this.prisma.betAndGetCampaign.findMany({
      where: { brandId },
      include: campaignInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Enabled AND currently within their scheduling window (if any), oldest first - what the player-facing list/matching logic iterates over. */
  async listEnabled(brandId: string) {
    const now = new Date();
    return this.prisma.betAndGetCampaign.findMany({
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
    const campaign = await this.prisma.betAndGetCampaign.findUnique({
      where: { id },
      include: campaignInclude,
    });
    if (!campaign || campaign.brandId !== brandId) {
      throw new NotFoundException('Bet & Get campaign not found');
    }
    return campaign;
  }

  async get(brandId: string, id: string) {
    return this.findOwned(brandId, id);
  }

  async create(brandId: string, input: CreateBetAndGetCampaignInput, actor: AuditActor) {
    const campaign = await this.prisma.betAndGetCampaign.create({
      data: {
        brandId,
        name: input.name,
        description: input.description,
        rewardAmountCents: input.rewardAmountCents,
        startAt: input.startAt ?? null,
        endAt: input.endAt ?? null,
        trigger: input.trigger ?? 'PLACEMENT',
        triggerOnWon: input.triggerOnWon ?? false,
        triggerOnLost: input.triggerOnLost ?? false,
        triggerOnVoid: input.triggerOnVoid ?? false,
        minStakeCents: input.minStakeCents ?? null,
        minOddsPerLeg: input.minOddsPerLeg ?? null,
        minCombinedOdds: input.minCombinedOdds ?? null,
        betType: input.betType ?? 'EITHER',
        minSelections: input.minSelections ?? null,
        bettingTiming: input.bettingTiming ?? 'EITHER',
        allowMultipleRedemptions: input.allowMultipleRedemptions ?? false,
        maxRedemptionsPerPlayer: input.maxRedemptionsPerPlayer ?? null,
        audienceMode: input.audienceMode ?? 'ALL',
        segments: input.segmentIds ? { create: input.segmentIds.map((segmentId) => ({ segmentId })) } : undefined,
      },
      include: campaignInclude,
    });

    await this.auditLogService.record({
      actor,
      action: 'BET_AND_GET_CAMPAIGN_CREATED',
      targetType: 'BetAndGetCampaign',
      targetId: campaign.id,
      metadata: { name: campaign.name },
    });

    return campaign;
  }

  async update(brandId: string, id: string, input: UpdateBetAndGetCampaignInput, actor: AuditActor) {
    await this.findOwned(brandId, id);

    const { segmentIds, ...rest } = input;

    const campaign = await this.prisma.betAndGetCampaign.update({
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
      action: 'BET_AND_GET_CAMPAIGN_UPDATED',
      targetType: 'BetAndGetCampaign',
      targetId: campaign.id,
      metadata: { name: campaign.name },
    });

    return campaign;
  }

  async remove(brandId: string, id: string, actor: AuditActor) {
    await this.findOwned(brandId, id);
    await this.prisma.betAndGetCampaign.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'BET_AND_GET_CAMPAIGN_REMOVED',
      targetType: 'BetAndGetCampaign',
      targetId: id,
    });
  }

  /** Replaces the campaign's whole scope list - the backoffice always sends the full set, not an incremental add/remove. */
  async setScopes(brandId: string, id: string, scopes: SetCampaignScopeInput[], actor: AuditActor) {
    await this.findOwned(brandId, id);

    const campaign = await this.prisma.betAndGetCampaign.update({
      where: { id },
      data: {
        scopes: {
          deleteMany: {},
          create: scopes.map((scope) => ({ scopeType: scope.scopeType, scopeValue: scope.scopeValue })),
        },
      },
      include: campaignInclude,
    });

    await this.auditLogService.record({
      actor,
      action: 'BET_AND_GET_CAMPAIGN_SCOPES_SET',
      targetType: 'BetAndGetCampaign',
      targetId: id,
      metadata: { scopeCount: scopes.length },
    });

    return campaign;
  }

  /**
   * Every enabled campaign whose scope covers this one match - backs the
   * public "campaigns for this match" lookup (match-detail context banner).
   * `timingBlocked` flags a campaign that's in scope but whose
   * bettingTiming rejects this match's current live status (e.g. a
   * PREMATCH_ONLY campaign once the match has kicked off), so the banner
   * can explain why betting here won't qualify rather than showing nothing.
   */
  async findActiveForMatch(brandId: string, match: ScopeMatchInput) {
    const campaigns = await this.listEnabled(brandId);
    return campaigns
      .filter((campaign) => matchIsInCampaignScope(campaign.scopes, match))
      .map((campaign) => ({
        ...campaign,
        timingBlocked: !matchTimingQualifies(campaign.bettingTiming, match.isLive),
      }));
  }

  /**
   * The one campaign (if any) a bet with these selections/stake qualifies
   * for - every selection's match must fall within the campaign's scope
   * (not just one leg) AND satisfy the campaign's bettingTiming (a
   * PREMATCH_ONLY campaign rejects the whole bet if even one leg's match
   * has already kicked off), and the bet must meet the campaign's own
   * conditions. Enabled campaigns are checked oldest-first and the bet
   * links to at most one, so overlapping campaigns never stack.
   */
  async resolveApplicableCampaign(
    brandId: string,
    matches: ScopeMatchInput[],
    bet: { stakeCents: number; legOdds: number[] },
  ) {
    const campaigns = await this.listEnabled(brandId);
    return (
      campaigns.find(
        (campaign) =>
          matches.every(
            (match) =>
              matchIsInCampaignScope(campaign.scopes, match) &&
              matchTimingQualifies(campaign.bettingTiming, match.isLive),
          ) && betQualifiesForCampaign(campaign, bet),
      ) ?? null
    );
  }

  /** How many times this player has already been rewarded by this campaign - counts every BET_AND_GET freebet grant tagged with it, regardless of that grant's current status. */
  async countRedemptions(campaignId: string, userId: string, client: PrismaClientLike = this.prisma): Promise<number> {
    return client.freebetGrant.count({
      where: { source: 'BET_AND_GET', sourceCampaignId: campaignId, userId },
    });
  }

  /**
   * Whether this player can still earn a reward from this campaign right
   * now, given how many times they already have. Callers granting a
   * SETTLEMENT-triggered reward must pass their own settlement transaction
   * as `client` - a player can have several qualifying bets outstanding at
   * once (none of them have granted anything yet since none have settled),
   * so checking against `this.prisma` outside that transaction would still
   * see zero redemptions for every one of them and let each grant its own
   * reward instead of only the first to settle.
   */
  async canRedeem(
    campaign: { id: string; allowMultipleRedemptions: boolean; maxRedemptionsPerPlayer: number | null },
    userId: string,
    client: PrismaClientLike = this.prisma,
  ): Promise<boolean> {
    if (!campaign.allowMultipleRedemptions) {
      return (await this.countRedemptions(campaign.id, userId, client)) === 0;
    }
    if (campaign.maxRedemptionsPerPlayer === null) {
      return true;
    }
    return (await this.countRedemptions(campaign.id, userId, client)) < campaign.maxRedemptionsPerPlayer;
  }
}

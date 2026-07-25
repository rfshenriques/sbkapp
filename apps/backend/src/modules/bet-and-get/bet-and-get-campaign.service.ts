import { Injectable, NotFoundException } from '@nestjs/common';
import type { BetAndGetBetType, BetAndGetScopeType, BetAndGetTrigger } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { betQualifiesForCampaign, matchIsInCampaignScope, type ScopeMatchInput } from './bet-and-get';

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
  betType?: BetAndGetBetType;
  minSelections?: number | null;
  allowMultipleRedemptions?: boolean;
  maxRedemptionsPerPlayer?: number | null;
}

export type UpdateBetAndGetCampaignInput = Partial<CreateBetAndGetCampaignInput> & { enabled?: boolean };

export interface SetCampaignScopeInput {
  scopeType: BetAndGetScopeType;
  scopeValue: string;
}

const campaignInclude = { scopes: true } as const;

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
        betType: input.betType ?? 'EITHER',
        minSelections: input.minSelections ?? null,
        allowMultipleRedemptions: input.allowMultipleRedemptions ?? false,
        maxRedemptionsPerPlayer: input.maxRedemptionsPerPlayer ?? null,
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

    const campaign = await this.prisma.betAndGetCampaign.update({
      where: { id },
      data: input,
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

  /** Every enabled campaign whose scope covers this one match - backs the public "campaigns for this match" lookup (match-detail context banner) and is reused by resolveApplicableCampaign below. */
  async findActiveForMatch(brandId: string, match: ScopeMatchInput) {
    const campaigns = await this.listEnabled(brandId);
    return campaigns.filter((campaign) => matchIsInCampaignScope(campaign.scopes, match));
  }

  /**
   * The one campaign (if any) a bet with these selections/stake qualifies
   * for - every selection's match must fall within the campaign's scope
   * (not just one leg), and the bet must meet the campaign's own
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
          matches.every((match) => matchIsInCampaignScope(campaign.scopes, match)) &&
          betQualifiesForCampaign(campaign, bet),
      ) ?? null
    );
  }

  /** How many times this player has already been rewarded by this campaign - counts every BET_AND_GET freebet grant tagged with it, regardless of that grant's current status. */
  async countRedemptions(campaignId: string, userId: string): Promise<number> {
    return this.prisma.freebetGrant.count({
      where: { source: 'BET_AND_GET', sourceCampaignId: campaignId, userId },
    });
  }

  /** Whether this player can still earn a reward from this campaign right now, given how many times they already have. */
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
}

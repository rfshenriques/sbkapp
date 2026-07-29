import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AudienceMode, BetAndGetBetType, BetAndGetScopeType, BetAndGetTiming, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { resolveAudience, type AudienceViewer } from '../audience/audience';
import {
  betQualifiesForCampaign,
  isCampaignScheduledActive,
  matchIsInCampaignScope,
  matchTimingQualifies,
  type QualifyingBetInput,
  type ScopeMatchInput,
} from '../bet-and-get/bet-and-get';
import { FreebetService } from '../freebets/freebet.service';

/** Same PrismaClientLike convention as FreebetService.grantSystem/BetAndGetCampaignService - lets a caller pass the active placement/settlement transaction. */
type PrismaClientLike = PrismaService | Prisma.TransactionClient;

export interface CreateLeaderboardCampaignInput {
  name: string;
  description?: string;
  startAt?: Date | null;
  /** Required - a leaderboard needs a definite end to rank against and grant prizes at. */
  endAt: Date;
  pointsPerEuroStaked?: number;
  useCombinedOddsAsMultiplier?: boolean;
  onlySettledWonCounts?: boolean;
  minStakeCents?: number | null;
  minOddsPerLeg?: number | null;
  minCombinedOdds?: number | null;
  betType?: BetAndGetBetType;
  minSelections?: number | null;
  bettingTiming?: BetAndGetTiming;
  audienceMode?: AudienceMode;
  segmentIds?: string[];
}

export type UpdateLeaderboardCampaignInput = Partial<Omit<CreateLeaderboardCampaignInput, 'endAt'>> & {
  endAt?: Date;
  enabled?: boolean;
};

export interface SetCampaignScopeInput {
  scopeType: BetAndGetScopeType;
  scopeValue: string;
}

export interface SetRewardTierInput {
  rankFrom: number;
  rankTo: number;
  rewardAmountCents: number;
}

const campaignInclude = { segments: true, scopes: true, rewardTiers: true } as const;

/** Every tier's own range must be valid (rankFrom >= 1, rankFrom <= rankTo) and no two tiers may overlap - checked here rather than per-row since it depends on the whole set, same convention as BetAndGetCampaignService's setScopes replacing the whole list at once. */
function assertRewardTiersValid(tiers: SetRewardTierInput[]) {
  const sorted = [...tiers].sort((a, b) => a.rankFrom - b.rankFrom);
  for (const tier of sorted) {
    if (tier.rankFrom < 1 || tier.rankFrom > tier.rankTo) {
      throw new BadRequestException('Each reward tier needs rankFrom >= 1 and rankFrom <= rankTo');
    }
  }
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous && current && current.rankFrom <= previous.rankTo) {
      throw new BadRequestException('Reward tier rank ranges must not overlap');
    }
  }
}

/**
 * Leaderboard campaigns - players opt in ("participate"), earn points from
 * qualifying bets per a staff-configured formula (see
 * calculateLeaderboardPoints), and get ranked automatically. See
 * LeaderboardCampaign in schema.prisma for the model shape. Points are
 * only ever finalized at settlement (see PamService.settleSelection) - this
 * service owns campaign config, opt-in, ranking reads, and end-of-campaign
 * prize granting.
 */
@Injectable()
export class LeaderboardCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly freebetService: FreebetService,
  ) {}

  async list(brandId: string) {
    return this.prisma.leaderboardCampaign.findMany({
      where: { brandId },
      include: campaignInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Enabled AND currently within their scheduling window, oldest first - what player-facing listing/matching iterates over. */
  async listEnabled(brandId: string) {
    const now = new Date();
    return this.prisma.leaderboardCampaign.findMany({
      where: {
        brandId,
        enabled: true,
        AND: [{ OR: [{ startAt: null }, { startAt: { lte: now } }] }, { endAt: { gte: now } }],
      },
      include: campaignInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  private async findOwned(brandId: string, id: string) {
    const campaign = await this.prisma.leaderboardCampaign.findUnique({
      where: { id },
      include: campaignInclude,
    });
    if (!campaign || campaign.brandId !== brandId) {
      throw new NotFoundException('Leaderboard campaign not found');
    }
    return campaign;
  }

  async get(brandId: string, id: string) {
    const campaign = await this.findOwned(brandId, id);
    await this.finalizeIfEnded(campaign.id);
    return this.findOwned(brandId, id);
  }

  async create(brandId: string, input: CreateLeaderboardCampaignInput, actor: AuditActor) {
    const campaign = await this.prisma.leaderboardCampaign.create({
      data: {
        brandId,
        name: input.name,
        description: input.description,
        startAt: input.startAt ?? null,
        endAt: input.endAt,
        pointsPerEuroStaked: input.pointsPerEuroStaked ?? 1,
        useCombinedOddsAsMultiplier: input.useCombinedOddsAsMultiplier ?? false,
        onlySettledWonCounts: input.onlySettledWonCounts ?? true,
        minStakeCents: input.minStakeCents ?? null,
        minOddsPerLeg: input.minOddsPerLeg ?? null,
        minCombinedOdds: input.minCombinedOdds ?? null,
        betType: input.betType ?? 'EITHER',
        minSelections: input.minSelections ?? null,
        bettingTiming: input.bettingTiming ?? 'EITHER',
        audienceMode: input.audienceMode ?? 'ALL',
        segments: input.segmentIds ? { create: input.segmentIds.map((segmentId) => ({ segmentId })) } : undefined,
      },
      include: campaignInclude,
    });

    await this.auditLogService.record({
      actor,
      action: 'LEADERBOARD_CAMPAIGN_CREATED',
      targetType: 'LeaderboardCampaign',
      targetId: campaign.id,
      metadata: { name: campaign.name },
    });

    return campaign;
  }

  async update(brandId: string, id: string, input: UpdateLeaderboardCampaignInput, actor: AuditActor) {
    await this.findOwned(brandId, id);
    const { segmentIds, ...rest } = input;

    const campaign = await this.prisma.leaderboardCampaign.update({
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
      action: 'LEADERBOARD_CAMPAIGN_UPDATED',
      targetType: 'LeaderboardCampaign',
      targetId: campaign.id,
      metadata: { name: campaign.name },
    });

    return campaign;
  }

  async remove(brandId: string, id: string, actor: AuditActor) {
    await this.findOwned(brandId, id);
    await this.prisma.leaderboardCampaign.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'LEADERBOARD_CAMPAIGN_REMOVED',
      targetType: 'LeaderboardCampaign',
      targetId: id,
    });
  }

  /** Replaces the campaign's whole scope list - same "always send the full set" convention as BetAndGetCampaignService.setScopes. */
  async setScopes(brandId: string, id: string, scopes: SetCampaignScopeInput[], actor: AuditActor) {
    await this.findOwned(brandId, id);

    const campaign = await this.prisma.leaderboardCampaign.update({
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
      action: 'LEADERBOARD_CAMPAIGN_SCOPES_SET',
      targetType: 'LeaderboardCampaign',
      targetId: id,
      metadata: { scopeCount: scopes.length },
    });

    return campaign;
  }

  /** Replaces the campaign's whole reward-tier list - same "always send the full set" convention as setScopes. */
  async setRewardTiers(brandId: string, id: string, tiers: SetRewardTierInput[], actor: AuditActor) {
    await this.findOwned(brandId, id);
    assertRewardTiersValid(tiers);

    const campaign = await this.prisma.leaderboardCampaign.update({
      where: { id },
      data: {
        rewardTiers: {
          deleteMany: {},
          create: tiers.map((tier) => ({
            rankFrom: tier.rankFrom,
            rankTo: tier.rankTo,
            rewardAmountCents: tier.rewardAmountCents,
          })),
        },
      },
      include: campaignInclude,
    });

    await this.auditLogService.record({
      actor,
      action: 'LEADERBOARD_CAMPAIGN_REWARD_TIERS_SET',
      targetType: 'LeaderboardCampaign',
      targetId: id,
      metadata: { tierCount: tiers.length },
    });

    return campaign;
  }

  /**
   * Every enabled, in-scope, condition-passing campaign this player has
   * already joined - resolved once at bet placement (see PamService), just
   * like BetAndGetCampaignService.resolveApplicableCampaign, except a bet
   * can link to several leaderboards at once (no "at most one" rule - a
   * single bet can count toward more than one running leaderboard).
   * Excludes campaigns the player hasn't opted into: joining is the
   * player's explicit signal they want their bets counted, so an
   * un-joined leaderboard never silently starts tracking someone.
   */
  async resolveLinkableCampaigns(
    brandId: string,
    matches: ScopeMatchInput[],
    bet: QualifyingBetInput,
    viewer: AudienceViewer,
    userId: string,
  ) {
    const campaigns = await this.listEnabled(brandId);
    const qualifying = campaigns.filter(
      (campaign) =>
        resolveAudience(campaign.audienceMode, campaign.segments.map((segment) => segment.segmentId), viewer) &&
        matches.every(
          (match) =>
            matchIsInCampaignScope(campaign.scopes, match) && matchTimingQualifies(campaign.bettingTiming, match.isLive),
        ) &&
        betQualifiesForCampaign(campaign, bet),
    );
    if (qualifying.length === 0) {
      return [];
    }

    const entries = await this.prisma.leaderboardEntry.findMany({
      where: { userId, leaderboardCampaignId: { in: qualifying.map((campaign) => campaign.id) } },
    });
    const entryByCampaignId = new Map(entries.map((entry) => [entry.leaderboardCampaignId, entry]));

    return qualifying
      .map((campaign) => ({ campaign, entry: entryByCampaignId.get(campaign.id) }))
      .filter((linked): linked is { campaign: (typeof qualifying)[number]; entry: NonNullable<typeof linked.entry> } =>
        linked.entry !== undefined,
      );
  }

  /** Opts a player into a leaderboard's ranking - idempotent, returns the existing entry if they've already joined rather than erroring. Only enabled, currently-scheduled campaigns can be joined. */
  async join(brandId: string, campaignId: string, userId: string) {
    const campaign = await this.prisma.leaderboardCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.brandId !== brandId) {
      throw new NotFoundException('Leaderboard campaign not found');
    }
    if (!isCampaignScheduledActive(campaign)) {
      throw new ConflictException('This leaderboard is not currently open for entries');
    }

    const existing = await this.prisma.leaderboardEntry.findUnique({
      where: { leaderboardCampaignId_userId: { leaderboardCampaignId: campaignId, userId } },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.leaderboardEntry.create({
      data: { leaderboardCampaignId: campaignId, userId, brandId },
    });
  }

  async getEntryForUser(campaignId: string, userId: string) {
    return this.prisma.leaderboardEntry.findUnique({
      where: { leaderboardCampaignId_userId: { leaderboardCampaignId: campaignId, userId } },
    });
  }

  /** Full ranking, best first - ties broken by who joined earliest. Live-computed rather than a maintained rank column (see LeaderboardEntry's doc comment in schema.prisma). */
  async getRankedEntries(campaignId: string, client: PrismaClientLike = this.prisma) {
    return client.leaderboardEntry.findMany({
      where: { leaderboardCampaignId: campaignId },
      orderBy: [{ pointsTotal: 'desc' }, { joinedAt: 'asc' }],
      include: { user: { select: { id: true, username: true } } },
    });
  }

  /**
   * Grants each rank's configured reward tier once the campaign has ended -
   * idempotent via an atomic conditional claim on prizesGrantedAt (prize
   * grants have no triggering bet, so they can't dedup on
   * FreebetGrant.sourceBetId the way every other system grant does). Two
   * callers: the staff "Finalize & Grant Prizes" admin action, and a lazy
   * opportunistic check from read paths once endAt has passed (see get()
   * above) - same "compute live, no sweep needed" spirit as
   * isCampaignScheduledActive, consistent with there being no scheduled-job
   * infrastructure anywhere in this codebase.
   */
  async finalizeIfEnded(campaignId: string): Promise<void> {
    const campaign = await this.prisma.leaderboardCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.prizesGrantedAt !== null || new Date() < campaign.endAt) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.leaderboardCampaign.updateMany({
        where: { id: campaignId, prizesGrantedAt: null },
        data: { prizesGrantedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return;
      }

      const [ranked, tiers] = await Promise.all([
        this.getRankedEntries(campaignId, tx),
        tx.leaderboardRewardTier.findMany({ where: { leaderboardCampaignId: campaignId } }),
      ]);

      for (const [index, entry] of ranked.entries()) {
        const rank = index + 1;
        const tier = tiers.find((candidate) => rank >= candidate.rankFrom && rank <= candidate.rankTo);
        if (!tier) {
          continue;
        }
        await this.freebetService.grantSystem(
          {
            userId: entry.userId,
            brandId: entry.brandId,
            amountCents: tier.rewardAmountCents,
            source: 'LEADERBOARD_CAMPAIGN',
            sourceCampaignId: campaignId,
          },
          tx,
        );
      }

      await this.auditLogService.record(
        {
          actor: { id: 'system', username: 'system:leaderboard-finalize', brandId: campaign.brandId },
          action: 'LEADERBOARD_CAMPAIGN_PRIZES_GRANTED',
          targetType: 'LeaderboardCampaign',
          targetId: campaignId,
          metadata: { entryCount: ranked.length },
        },
        tx,
      );
    });
  }
}

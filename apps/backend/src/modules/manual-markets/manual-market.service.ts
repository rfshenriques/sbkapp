import { Injectable, NotFoundException } from '@nestjs/common';
import type { AudienceMode, Prisma } from '@prisma/client';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { ANONYMOUS_VIEWER, resolveAudience, type AudienceViewer } from '../audience/audience';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

export interface ManualMarketSelectionInput {
  name: string;
  odds: number;
}

export interface SetManualMarketLimitsInput {
  maxStakeCents?: number | null;
  maxLiabilityCents?: number | null;
  audienceMode?: AudienceMode;
  segmentIds?: string[];
  staysLiveDuringInplay?: boolean;
  singlesOnly?: boolean;
}

/**
 * A trader-created market that doesn't exist in the odds feed at all -
 * e.g. a special/novelty market the-odds-api.com never carries for this
 * match. Merged into the public matches response as an extra market
 * alongside the feed's own, carrying whatever price the trader set
 * directly (no margin pipeline involvement - there's no feed price to
 * apply a margin to).
 */
@Injectable()
export class ManualMarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createMarket(
    brandId: string,
    matchId: string,
    name: string,
    selections: ManualMarketSelectionInput[],
    actor: AuditActor,
  ) {
    const market = await this.prisma.manualMarket.create({
      data: {
        brandId,
        matchId,
        name,
        selections: { create: selections },
      },
      include: { selections: true },
    });

    await this.auditLogService.record({
      actor,
      action: 'MANUAL_MARKET_CREATED',
      targetType: 'ManualMarket',
      targetId: market.id,
      metadata: { matchId, name, selections: selections.map(({ name: n, odds }) => ({ name: n, odds })) },
    });

    return market;
  }

  /**
   * Replaces the market's name and its entire selection list in one write -
   * a trader fixing a typo or repricing doesn't need to delete and
   * recreate. `brandId` must match the market's own brand, same as
   * removeMarket.
   */
  async updateMarket(
    brandId: string,
    id: string,
    name: string,
    selections: ManualMarketSelectionInput[],
    actor: AuditActor,
  ) {
    const existing = await this.prisma.manualMarket.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Manual market not found');
    }

    const market = await this.prisma.manualMarket.update({
      where: { id },
      data: {
        name,
        selections: { deleteMany: {}, create: selections },
      },
      include: { selections: true },
    });

    await this.auditLogService.record({
      actor,
      action: 'MANUAL_MARKET_UPDATED',
      targetType: 'ManualMarket',
      targetId: market.id,
      metadata: { name, selections: selections.map(({ name: n, odds }) => ({ name: n, odds })) },
    });

    return market;
  }

  /** `brandId` must match the market's own brand - a staff member can never remove another brand's manual market, even by guessing its id. */
  async removeMarket(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.manualMarket.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Manual market not found');
    }

    const market = await this.prisma.manualMarket.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'MANUAL_MARKET_REMOVED',
      targetType: 'ManualMarket',
      targetId: market.id,
      metadata: { matchId: market.matchId, name: market.name },
    });

    return market;
  }

  async listMarkets(brandId: string) {
    return this.prisma.manualMarket.findMany({
      where: { brandId },
      include: { selections: true, audienceSegments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Replaces stake/liability caps and/or audience targeting in one write -
   * a separate endpoint from create/update so a trader adjusting a limit
   * doesn't have to resend the whole selection list. Only the fields
   * present in `input` change; omit a field to leave it as-is.
   */
  async setLimits(brandId: string, id: string, input: SetManualMarketLimitsInput, actor: AuditActor) {
    const existing = await this.prisma.manualMarket.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Manual market not found');
    }

    const market = await this.prisma.manualMarket.update({
      where: { id },
      data: {
        ...(input.maxStakeCents !== undefined ? { maxStakeCents: input.maxStakeCents } : {}),
        ...(input.maxLiabilityCents !== undefined ? { maxLiabilityCents: input.maxLiabilityCents } : {}),
        ...(input.audienceMode !== undefined ? { audienceMode: input.audienceMode } : {}),
        ...(input.segmentIds !== undefined
          ? {
              audienceSegments: {
                deleteMany: {},
                create: input.segmentIds.map((segmentId) => ({ segmentId })),
              },
            }
          : {}),
        ...(input.staysLiveDuringInplay !== undefined
          ? { staysLiveDuringInplay: input.staysLiveDuringInplay }
          : {}),
        ...(input.singlesOnly !== undefined ? { singlesOnly: input.singlesOnly } : {}),
      },
      include: { selections: true, audienceSegments: true },
    });

    await this.auditLogService.record({
      actor,
      action: 'MANUAL_MARKET_LIMITS_SET',
      targetType: 'ManualMarket',
      targetId: market.id,
      metadata: { ...input },
    });

    return market;
  }

  /** Used by PamService at bet placement to check stake/liability caps - brandId-scoped, same as every other lookup here. A disabled market (liability cap hit) is treated as not found, same as Boost.findActiveForBet. */
  async findForBet(brandId: string, id: string) {
    const market = await this.prisma.manualMarket.findUnique({ where: { id } });
    return market && market.brandId === brandId && market.disabledAt === null ? market : null;
  }

  /**
   * Adds to the market's running exposure after a bet is accepted, then
   * auto-disables it if that pushes currentLiabilityCents past
   * maxLiabilityCents - mirrors BoostService.recordLiabilityAndMaybeDisable.
   * Accepts an optional transaction client so PamService can run this
   * atomically alongside the bet it belongs to.
   */
  async recordLiabilityAndMaybeDisable(
    id: string,
    liabilityCents: number,
    actor: AuditActor,
    client: PrismaClientLike = this.prisma,
  ) {
    const market = await client.manualMarket.update({
      where: { id },
      data: { currentLiabilityCents: { increment: liabilityCents } },
    });

    if (market.maxLiabilityCents !== null && market.currentLiabilityCents >= market.maxLiabilityCents) {
      const disabled = await client.manualMarket.update({
        where: { id },
        data: { disabledAt: new Date() },
      });
      await this.auditLogService.record(
        {
          actor,
          action: 'MANUAL_MARKET_AUTO_DISABLED',
          targetType: 'ManualMarket',
          targetId: disabled.id,
          metadata: {
            currentLiabilityCents: disabled.currentLiabilityCents,
            maxLiabilityCents: disabled.maxLiabilityCents,
          },
        },
        client,
      );
    }
  }

  /**
   * Appends each match's manual markets (if any) onto its markets array,
   * filtered to whatever this viewer's audience can see and, since a
   * manually-priced market has no live re-pricing feed behind it,
   * suppressed once its match goes in-play unless staysLiveDuringInplay was
   * explicitly set - matches with none visible pass through unchanged.
   */
  async mergeIntoMatches(brandId: string, matches: Match[], viewer: AudienceViewer = ANONYMOUS_VIEWER): Promise<Match[]> {
    const manualMarkets = await this.prisma.manualMarket.findMany({
      where: { brandId, matchId: { in: matches.map((match) => match.id) }, disabledAt: null },
      include: { selections: true, audienceSegments: true },
    });
    const isLiveByMatchId = new Map(matches.map((match) => [match.id, match.isLive]));
    const visibleMarkets = manualMarkets.filter(
      (manualMarket) =>
        (manualMarket.staysLiveDuringInplay || !isLiveByMatchId.get(manualMarket.matchId)) &&
        resolveAudience(
          manualMarket.audienceMode,
          manualMarket.audienceSegments.map((segment) => segment.segmentId),
          viewer,
        ),
    );
    if (visibleMarkets.length === 0) {
      return matches;
    }

    const marketsByMatchId = new Map<string, Match['markets']>();
    for (const manualMarket of visibleMarkets) {
      const mapped = marketsByMatchId.get(manualMarket.matchId) ?? [];
      mapped.push({
        id: manualMarket.id,
        name: manualMarket.name,
        isSpecial: true,
        maxStakeCents: manualMarket.maxStakeCents ?? undefined,
        singlesOnly: manualMarket.singlesOnly || undefined,
        selections: manualMarket.selections.map((selection) => ({
          id: selection.id,
          name: selection.name,
          odds: selection.odds,
        })),
      });
      marketsByMatchId.set(manualMarket.matchId, mapped);
    }

    return matches.map((match) => {
      const extraMarkets = marketsByMatchId.get(match.id);
      return extraMarkets ? { ...match, markets: [...match.markets, ...extraMarkets] } : match;
    });
  }
}

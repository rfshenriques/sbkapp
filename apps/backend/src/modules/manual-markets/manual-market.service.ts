import { Injectable, NotFoundException } from '@nestjs/common';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

export interface ManualMarketSelectionInput {
  name: string;
  odds: number;
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
      include: { selections: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Appends each match's manual markets (if any) onto its markets array; matches with none pass through unchanged. */
  async mergeIntoMatches(brandId: string, matches: Match[]): Promise<Match[]> {
    const manualMarkets = await this.prisma.manualMarket.findMany({
      where: { brandId, matchId: { in: matches.map((match) => match.id) } },
      include: { selections: true },
    });
    if (manualMarkets.length === 0) {
      return matches;
    }

    const marketsByMatchId = new Map<string, Match['markets']>();
    for (const manualMarket of manualMarkets) {
      const mapped = marketsByMatchId.get(manualMarket.matchId) ?? [];
      mapped.push({
        id: manualMarket.id,
        name: manualMarket.name,
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

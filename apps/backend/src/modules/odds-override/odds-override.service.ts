import { Injectable, NotFoundException } from '@nestjs/common';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

function overrideKey(matchId: string, marketId: string, selectionId: string): string {
  return `${matchId}:${marketId}:${selectionId}`;
}

/**
 * A trader's manual fixed price for one selection - applied to
 * PublicMatchesController's response after MarginPricingService, and
 * entirely independent of it: an overridden selection's price comes
 * straight from oddsValue, never blended with the tier/margin calculation.
 */
@Injectable()
export class OddsOverrideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Idempotent - overriding an already-overridden selection just updates the price/reason. */
  async setOverride(
    brandId: string,
    matchId: string,
    marketId: string,
    selectionId: string,
    oddsValue: number,
    reason: string | undefined,
    actor: AuditActor,
  ) {
    const override = await this.prisma.oddsOverride.upsert({
      where: { brandId_matchId_marketId_selectionId: { brandId, matchId, marketId, selectionId } },
      create: { brandId, matchId, marketId, selectionId, oddsValue, reason },
      update: { oddsValue, reason },
    });

    await this.auditLogService.record({
      actor,
      action: 'ODDS_OVERRIDE_SET',
      targetType: 'Selection',
      targetId: overrideKey(matchId, marketId, selectionId),
      metadata: { matchId, marketId, selectionId, oddsValue, reason: reason ?? null },
    });

    return override;
  }

  /** `brandId` must match the override's own brand - a staff member can never clear another brand's override, even by guessing its id. */
  async clearOverride(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.oddsOverride.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Odds override not found');
    }

    const override = await this.prisma.oddsOverride.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'ODDS_OVERRIDE_CLEARED',
      targetType: 'Selection',
      targetId: overrideKey(override.matchId, override.marketId, override.selectionId),
      metadata: { matchId: override.matchId, marketId: override.marketId, selectionId: override.selectionId },
    });

    return override;
  }

  async listOverrides(brandId: string) {
    return this.prisma.oddsOverride.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Substitutes each overridden selection's odds with its fixed oddsValue; matches with no override pass through unchanged. */
  async applyOverrides(brandId: string, matches: Match[]): Promise<Match[]> {
    const overrides = await this.prisma.oddsOverride.findMany({ where: { brandId } });
    if (overrides.length === 0) {
      return matches;
    }
    const oddsByKey = new Map(
      overrides.map((override) => [
        overrideKey(override.matchId, override.marketId, override.selectionId),
        override.oddsValue,
      ]),
    );

    return matches.map((match) => ({
      ...match,
      markets: match.markets.map((market) => ({
        ...market,
        selections: market.selections.map((selection) => {
          const overrideOdds = oddsByKey.get(overrideKey(match.id, market.id, selection.id));
          return overrideOdds === undefined ? selection : { ...selection, odds: overrideOdds };
        }),
      })),
    }));
  }
}

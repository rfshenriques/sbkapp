import { Injectable, NotFoundException } from '@nestjs/common';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { applyBoostToPrice } from './odds-ladder';
import { OddsLadderService } from './odds-ladder.service';

function boostKey(matchId: string, marketId: string, selectionId: string): string {
  return `${matchId}:${marketId}:${selectionId}`;
}

/**
 * A trader-configured price boost: instead of a fixed price (see
 * OddsOverride), this climbs a selection N rungs up the brand's odds
 * ladder from whatever price it would otherwise show - applied as the very
 * last step of the public matches pricing pipeline, after margin, manual
 * markets, and odds overrides.
 */
@Injectable()
export class BoostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly oddsLadderService: OddsLadderService,
  ) {}

  /** Idempotent - re-setting an already-boosted selection updates its ticks/reason in place. This is how a trader edits a boost: set it again with the new tick count. */
  async setBoost(
    brandId: string,
    matchId: string,
    marketId: string,
    selectionId: string,
    ticks: number,
    reason: string | undefined,
    actor: AuditActor,
  ) {
    const boost = await this.prisma.boost.upsert({
      where: { brandId_matchId_marketId_selectionId: { brandId, matchId, marketId, selectionId } },
      create: { brandId, matchId, marketId, selectionId, ticks, reason },
      update: { ticks, reason },
    });

    await this.auditLogService.record({
      actor,
      action: 'BOOST_SET',
      targetType: 'Selection',
      targetId: boostKey(matchId, marketId, selectionId),
      metadata: { matchId, marketId, selectionId, ticks, reason: reason ?? null },
    });

    return boost;
  }

  /** `brandId` must match the boost's own brand - a staff member can never clear another brand's boost, even by guessing its id. */
  async clearBoost(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.boost.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Boost not found');
    }

    const boost = await this.prisma.boost.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'BOOST_CLEARED',
      targetType: 'Selection',
      targetId: boostKey(boost.matchId, boost.marketId, boost.selectionId),
      metadata: { matchId: boost.matchId, marketId: boost.marketId, selectionId: boost.selectionId },
    });

    return boost;
  }

  async listBoosts(brandId: string) {
    return this.prisma.boost.findMany({ where: { brandId }, orderBy: { createdAt: 'desc' } });
  }

  /**
   * Applies each boost as the very last pricing step: takes whatever price
   * a selection would otherwise show (margin + manual markets + overrides
   * already applied), climbs it up the brand's odds ladder, and records
   * the pre-boost price as originalOdds so the player UI can show both.
   * Matches with no boosted selection pass through unchanged.
   */
  async applyBoosts(brandId: string, matches: Match[]): Promise<Match[]> {
    const boosts = await this.prisma.boost.findMany({ where: { brandId } });
    if (boosts.length === 0) {
      return matches;
    }
    const ladder = await this.oddsLadderService.listRungValues(brandId);
    const ticksByKey = new Map(
      boosts.map((boost) => [boostKey(boost.matchId, boost.marketId, boost.selectionId), boost.ticks]),
    );

    return matches.map((match) => ({
      ...match,
      markets: match.markets.map((market) => ({
        ...market,
        selections: market.selections.map((selection) => {
          const ticks = ticksByKey.get(boostKey(match.id, market.id, selection.id));
          if (ticks === undefined) {
            return selection;
          }
          const boostedOdds = applyBoostToPrice(ladder, selection.odds, ticks);
          if (boostedOdds === selection.odds) {
            // No ladder configured (or already at the top rung) - nothing actually changed, so don't claim a boost happened.
            return selection;
          }
          return { ...selection, odds: boostedOdds, originalOdds: selection.odds };
        }),
      })),
    }));
  }
}

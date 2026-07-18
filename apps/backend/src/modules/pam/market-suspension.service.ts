import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

/** MarketSuspension.marketId value meaning "the whole match, every market". */
const WHOLE_MATCH_MARKER = '';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class MarketSuspensionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Idempotent - re-suspending an already-suspended match/market just updates the reason. */
  async suspend(
    brandId: string,
    matchId: string,
    marketId: string | undefined,
    reason: string | undefined,
    actor: AuditActor,
  ) {
    const normalizedMarketId = marketId ?? WHOLE_MATCH_MARKER;
    const suspension = await this.prisma.marketSuspension.upsert({
      where: { brandId_matchId_marketId: { brandId, matchId, marketId: normalizedMarketId } },
      create: { brandId, matchId, marketId: normalizedMarketId, reason },
      update: { reason },
    });

    await this.auditLogService.record({
      actor,
      action: 'MARKET_SUSPENDED',
      targetType: normalizedMarketId === WHOLE_MATCH_MARKER ? 'Match' : 'Market',
      targetId:
        normalizedMarketId === WHOLE_MATCH_MARKER ? matchId : `${matchId}:${normalizedMarketId}`,
      metadata: { matchId, marketId: normalizedMarketId || null, reason: reason ?? null },
    });

    return suspension;
  }

  /** `brandId` must match the suspension's own brand - a staff member can never unsuspend another brand's market, even by guessing its id. */
  async unsuspend(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.marketSuspension.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Suspension not found');
    }

    const suspension = await this.prisma.marketSuspension.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'MARKET_UNSUSPENDED',
      targetType: suspension.marketId === WHOLE_MATCH_MARKER ? 'Match' : 'Market',
      targetId:
        suspension.marketId === WHOLE_MATCH_MARKER
          ? suspension.matchId
          : `${suspension.matchId}:${suspension.marketId}`,
      metadata: { matchId: suspension.matchId, marketId: suspension.marketId || null },
    });

    return suspension;
  }

  async listSuspensions(brandId: string) {
    return this.prisma.marketSuspension.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Whole-match and market-specific suspensions both block bets on that market, scoped to one brand. */
  async isSuspended(
    brandId: string,
    matchId: string,
    marketId: string,
    client: PrismaClientLike = this.prisma,
  ): Promise<boolean> {
    const suspension = await client.marketSuspension.findFirst({
      where: { brandId, matchId, marketId: { in: [WHOLE_MATCH_MARKER, marketId] } },
    });
    return suspension !== null;
  }
}

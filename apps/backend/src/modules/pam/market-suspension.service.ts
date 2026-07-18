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
    matchId: string,
    marketId: string | undefined,
    reason: string | undefined,
    actor: AuditActor,
  ) {
    const normalizedMarketId = marketId ?? WHOLE_MATCH_MARKER;
    const suspension = await this.prisma.marketSuspension.upsert({
      where: { matchId_marketId: { matchId, marketId: normalizedMarketId } },
      create: { matchId, marketId: normalizedMarketId, reason },
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

  async unsuspend(id: string, actor: AuditActor) {
    const suspension = await this.prisma.marketSuspension
      .delete({ where: { id } })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new NotFoundException('Suspension not found');
        }
        throw error;
      });

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

  async listSuspensions() {
    return this.prisma.marketSuspension.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** Whole-match and market-specific suspensions both block bets on that market. */
  async isSuspended(
    matchId: string,
    marketId: string,
    client: PrismaClientLike = this.prisma,
  ): Promise<boolean> {
    const suspension = await client.marketSuspension.findFirst({
      where: { matchId, marketId: { in: [WHOLE_MATCH_MARKER, marketId] } },
    });
    return suspension !== null;
  }
}

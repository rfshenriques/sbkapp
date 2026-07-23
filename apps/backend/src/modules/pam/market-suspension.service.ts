import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

/** MarketSuspension.marketId value meaning "the whole match, every market". */
const WHOLE_MATCH_MARKER = '';
/** MarketSuspension.selectionId value meaning "the whole market, every selection". */
const WHOLE_MARKET_MARKER = '';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

function targetTypeFor(marketId: string, selectionId: string): string {
  if (marketId === WHOLE_MATCH_MARKER) return 'Match';
  if (selectionId === WHOLE_MARKET_MARKER) return 'Market';
  return 'Selection';
}

function targetIdFor(matchId: string, marketId: string, selectionId: string): string {
  if (marketId === WHOLE_MATCH_MARKER) return matchId;
  if (selectionId === WHOLE_MARKET_MARKER) return `${matchId}:${marketId}`;
  return `${matchId}:${marketId}:${selectionId}`;
}

@Injectable()
export class MarketSuspensionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Idempotent - re-suspending an already-suspended match/market/selection
   * just updates the reason. Omit marketId to suspend the whole match, omit
   * selectionId (with a marketId) to suspend the whole market - a
   * selectionId without a marketId doesn't mean anything, so it's rejected.
   */
  async suspend(
    brandId: string,
    matchId: string,
    marketId: string | undefined,
    selectionId: string | undefined,
    reason: string | undefined,
    actor: AuditActor,
  ) {
    const normalizedMarketId = marketId ?? WHOLE_MATCH_MARKER;
    const normalizedSelectionId = selectionId ?? WHOLE_MARKET_MARKER;
    if (normalizedSelectionId !== WHOLE_MARKET_MARKER && normalizedMarketId === WHOLE_MATCH_MARKER) {
      throw new BadRequestException('selectionId requires a marketId');
    }

    const suspension = await this.prisma.marketSuspension.upsert({
      where: {
        brandId_matchId_marketId_selectionId: {
          brandId,
          matchId,
          marketId: normalizedMarketId,
          selectionId: normalizedSelectionId,
        },
      },
      create: { brandId, matchId, marketId: normalizedMarketId, selectionId: normalizedSelectionId, reason },
      update: { reason },
    });

    await this.auditLogService.record({
      actor,
      action: 'MARKET_SUSPENDED',
      targetType: targetTypeFor(normalizedMarketId, normalizedSelectionId),
      targetId: targetIdFor(matchId, normalizedMarketId, normalizedSelectionId),
      metadata: {
        matchId,
        marketId: normalizedMarketId || null,
        selectionId: normalizedSelectionId || null,
        reason: reason ?? null,
      },
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
      targetType: targetTypeFor(suspension.marketId, suspension.selectionId),
      targetId: targetIdFor(suspension.matchId, suspension.marketId, suspension.selectionId),
      metadata: {
        matchId: suspension.matchId,
        marketId: suspension.marketId || null,
        selectionId: suspension.selectionId || null,
      },
    });

    return suspension;
  }

  async listSuspensions(brandId: string) {
    return this.prisma.marketSuspension.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Whole-match, whole-market, and exact-selection suspensions all block
   * bets on that selection, scoped to one brand. `selectionId` is optional
   * so market-level UI checks (locking every selection in a market) can
   * still call this without knowing a specific selection.
   */
  async isSuspended(
    brandId: string,
    matchId: string,
    marketId: string,
    selectionId: string = WHOLE_MARKET_MARKER,
    client: PrismaClientLike = this.prisma,
  ): Promise<boolean> {
    const suspension = await client.marketSuspension.findFirst({
      where: {
        brandId,
        matchId,
        OR: [
          { marketId: WHOLE_MATCH_MARKER },
          { marketId, selectionId: WHOLE_MARKET_MARKER },
          ...(selectionId !== WHOLE_MARKET_MARKER ? [{ marketId, selectionId }] : []),
        ],
      },
    });
    return suspension !== null;
  }
}

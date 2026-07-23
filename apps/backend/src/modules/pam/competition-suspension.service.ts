import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

/**
 * Blocks new bets on every match in a named competition, for one brand -
 * the coarser sibling of MarketSuspension (which can only target a single
 * match/market/selection, since matches themselves are never persisted).
 */
@Injectable()
export class CompetitionSuspensionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Idempotent - re-suspending an already-suspended competition just updates the reason. */
  async suspend(brandId: string, competition: string, reason: string | undefined, actor: AuditActor) {
    const suspension = await this.prisma.competitionSuspension.upsert({
      where: { brandId_competition: { brandId, competition } },
      create: { brandId, competition, reason },
      update: { reason },
    });

    await this.auditLogService.record({
      actor,
      action: 'COMPETITION_SUSPENDED',
      targetType: 'Competition',
      targetId: competition,
      metadata: { competition, reason: reason ?? null },
    });

    return suspension;
  }

  /** `brandId` must match the suspension's own brand - a staff member can never unsuspend another brand's competition suspension, even by guessing its id. */
  async unsuspend(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.competitionSuspension.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Suspension not found');
    }

    const suspension = await this.prisma.competitionSuspension.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'COMPETITION_UNSUSPENDED',
      targetType: 'Competition',
      targetId: suspension.competition,
      metadata: { competition: suspension.competition },
    });

    return suspension;
  }

  async listSuspensions(brandId: string) {
    return this.prisma.competitionSuspension.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async isSuspended(brandId: string, competition: string): Promise<boolean> {
    const suspension = await this.prisma.competitionSuspension.findUnique({
      where: { brandId_competition: { brandId, competition } },
    });
    return suspension !== null;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

@Injectable()
export class CompetitionTierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Idempotent - setting a tier for an already-tiered competition just updates it. */
  async setTier(brandId: string, competition: string, tier: number, actor: AuditActor) {
    const row = await this.prisma.competitionTier.upsert({
      where: { brandId_competition: { brandId, competition } },
      create: { brandId, competition, tier },
      update: { tier },
    });

    await this.auditLogService.record({
      actor,
      action: 'COMPETITION_TIER_SET',
      targetType: 'CompetitionTier',
      targetId: row.id,
      metadata: { competition, tier },
    });

    return row;
  }

  /** `brandId` must match the row's own brand - a staff member can never remove another brand's tier assignment, even by guessing its id. */
  async removeTier(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.competitionTier.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Competition tier not found');
    }

    const row = await this.prisma.competitionTier.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'COMPETITION_TIER_REMOVED',
      targetType: 'CompetitionTier',
      targetId: row.id,
      metadata: { competition: row.competition },
    });

    return row;
  }

  async listTiers(brandId: string) {
    return this.prisma.competitionTier.findMany({
      where: { brandId },
      orderBy: { competition: 'asc' },
    });
  }
}

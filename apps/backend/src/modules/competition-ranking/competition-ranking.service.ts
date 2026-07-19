import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

@Injectable()
export class CompetitionRankingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Idempotent - setting a rank for an already-ranked competition just updates it. */
  async setRanking(brandId: string, competition: string, rank: number, actor: AuditActor) {
    const ranking = await this.prisma.competitionRanking.upsert({
      where: { brandId_competition: { brandId, competition } },
      create: { brandId, competition, rank },
      update: { rank },
    });

    await this.auditLogService.record({
      actor,
      action: 'COMPETITION_RANKING_SET',
      targetType: 'CompetitionRanking',
      targetId: ranking.id,
      metadata: { competition, rank },
    });

    return ranking;
  }

  /** `brandId` must match the ranking's own brand - a staff member can never remove another brand's ranking, even by guessing its id. */
  async removeRanking(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.competitionRanking.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Competition ranking not found');
    }

    const ranking = await this.prisma.competitionRanking.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'COMPETITION_RANKING_REMOVED',
      targetType: 'CompetitionRanking',
      targetId: ranking.id,
      metadata: { competition: ranking.competition },
    });

    return ranking;
  }

  async listRankings(brandId: string) {
    return this.prisma.competitionRanking.findMany({
      where: { brandId },
      orderBy: { rank: 'asc' },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

@Injectable()
export class CompetitionQuicklinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Idempotent - setting an order for an already-listed competition just updates it. */
  async setQuicklink(brandId: string, competition: string, order: number, actor: AuditActor) {
    const quicklink = await this.prisma.competitionQuicklink.upsert({
      where: { brandId_competition: { brandId, competition } },
      create: { brandId, competition, order },
      update: { order },
    });

    await this.auditLogService.record({
      actor,
      action: 'COMPETITION_QUICKLINK_SET',
      targetType: 'CompetitionQuicklink',
      targetId: quicklink.id,
      metadata: { competition, order },
    });

    return quicklink;
  }

  /** `brandId` must match the quicklink's own brand - a staff member can never remove another brand's quicklink, even by guessing its id. */
  async removeQuicklink(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.competitionQuicklink.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Competition quicklink not found');
    }

    const quicklink = await this.prisma.competitionQuicklink.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'COMPETITION_QUICKLINK_REMOVED',
      targetType: 'CompetitionQuicklink',
      targetId: quicklink.id,
      metadata: { competition: quicklink.competition },
    });

    return quicklink;
  }

  async listQuicklinks(brandId: string) {
    return this.prisma.competitionQuicklink.findMany({
      where: { brandId },
      orderBy: { order: 'asc' },
    });
  }
}

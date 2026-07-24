import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

@Injectable()
export class MarginConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Idempotent - setting a margin for an already-configured (sport, marketName, tier) triple just updates it. */
  async setMargin(
    brandId: string,
    sport: string,
    marketName: string,
    tier: number,
    marginPercent: number,
    actor: AuditActor,
  ) {
    const row = await this.prisma.marginConfig.upsert({
      where: { brandId_sport_marketName_tier: { brandId, sport, marketName, tier } },
      create: { brandId, sport, marketName, tier, marginPercent },
      update: { marginPercent },
    });

    await this.auditLogService.record({
      actor,
      action: 'MARGIN_CONFIG_SET',
      targetType: 'MarginConfig',
      targetId: row.id,
      metadata: { sport, marketName, tier, marginPercent },
    });

    return row;
  }

  /** `brandId` must match the row's own brand - a staff member can never remove another brand's margin config, even by guessing its id. */
  async removeMargin(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.marginConfig.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Margin config not found');
    }

    const row = await this.prisma.marginConfig.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'MARGIN_CONFIG_REMOVED',
      targetType: 'MarginConfig',
      targetId: row.id,
      metadata: { sport: row.sport, marketName: row.marketName, tier: row.tier },
    });

    return row;
  }

  async listMargins(brandId: string) {
    return this.prisma.marginConfig.findMany({
      where: { brandId },
      orderBy: [{ sport: 'asc' }, { marketName: 'asc' }, { tier: 'asc' }],
    });
  }
}

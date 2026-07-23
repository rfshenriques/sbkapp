import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { generateStandardLadder } from './odds-ladder';

/**
 * A brand's price grid - the only decimal odds BoostService is ever
 * allowed to land a boosted price on. Seeded via regenerateStandard with
 * the real industry-standard tick ladder, then freely adjusted (add/remove
 * individual rungs) by trading from the backoffice.
 */
@Injectable()
export class OddsLadderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listRungs(brandId: string) {
    return this.prisma.oddsLadderRung.findMany({
      where: { brandId },
      orderBy: { value: 'asc' },
    });
  }

  /** Sorted ascending values only - what BoostService actually climbs. */
  async listRungValues(brandId: string): Promise<number[]> {
    const rungs = await this.listRungs(brandId);
    return rungs.map((rung) => rung.value);
  }

  /** Idempotent - adding a value that's already a rung is a no-op (the unique constraint just no-ops via upsert). */
  async addRung(brandId: string, value: number, actor: AuditActor) {
    const rung = await this.prisma.oddsLadderRung.upsert({
      where: { brandId_value: { brandId, value } },
      create: { brandId, value },
      update: {},
    });

    await this.auditLogService.record({
      actor,
      action: 'ODDS_LADDER_RUNG_ADDED',
      targetType: 'OddsLadderRung',
      targetId: rung.id,
      metadata: { value },
    });

    return rung;
  }

  /** `brandId` must match the rung's own brand - a staff member can never remove another brand's rung, even by guessing its id. */
  async removeRung(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.oddsLadderRung.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Odds ladder rung not found');
    }

    const rung = await this.prisma.oddsLadderRung.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'ODDS_LADDER_RUNG_REMOVED',
      targetType: 'OddsLadderRung',
      targetId: rung.id,
      metadata: { value: rung.value },
    });

    return rung;
  }

  /** Wipes the brand's ladder and reseeds it with the standard grid - trading can then adjust individual rungs from there. */
  async regenerateStandard(brandId: string, actor: AuditActor) {
    const values = generateStandardLadder();

    await this.prisma.$transaction([
      this.prisma.oddsLadderRung.deleteMany({ where: { brandId } }),
      this.prisma.oddsLadderRung.createMany({ data: values.map((value) => ({ brandId, value })) }),
    ]);

    await this.auditLogService.record({
      actor,
      action: 'ODDS_LADDER_REGENERATED',
      targetType: 'OddsLadderRung',
      targetId: brandId,
      metadata: { rungCount: values.length },
    });

    return this.listRungs(brandId);
  }
}

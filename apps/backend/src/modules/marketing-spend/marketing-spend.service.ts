import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import type { ReportRange } from '../reports/reports.service';

@Injectable()
export class MarketingSpendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(brandId: string, range: ReportRange) {
    return this.prisma.marketingSpend.findMany({
      where: {
        brandId,
        ...(range.from || range.to
          ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
          : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  async create(
    brandId: string,
    input: { date: Date; channel: string; amountCents: number },
    actor: AuditActor,
  ) {
    const spend = await this.prisma.marketingSpend.create({
      data: {
        brandId,
        date: input.date,
        channel: input.channel,
        amountCents: input.amountCents,
        createdByStaffUserId: actor.id,
        createdByUsername: actor.username,
      },
    });

    await this.auditLogService.record({
      actor,
      action: 'MARKETING_SPEND_CREATED',
      targetType: 'MarketingSpend',
      targetId: spend.id,
      metadata: { date: input.date.toISOString(), channel: input.channel, amountCents: input.amountCents },
    });

    return spend;
  }

  /** `brandId` must match the spend row's own brand - a staff member can never remove another brand's entry, even by guessing its id. */
  async remove(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.marketingSpend.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Marketing spend entry not found');
    }

    const spend = await this.prisma.marketingSpend.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'MARKETING_SPEND_REMOVED',
      targetType: 'MarketingSpend',
      targetId: spend.id,
      metadata: { date: spend.date.toISOString(), channel: spend.channel, amountCents: spend.amountCents },
    });

    return spend;
  }
}

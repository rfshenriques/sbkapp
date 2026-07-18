import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ReportRange {
  from?: Date;
  to?: Date;
}

export interface StatusBreakdownEntry {
  status: string;
  count: number;
  stakeCents: number;
}

export interface ReportSummary {
  from: string | null;
  to: string | null;
  betCount: number;
  totalStakeCents: number;
  settledBetCount: number;
  settledStakeCents: number;
  settledPayoutCents: number;
  /** Settled-only: sum(stake) - sum(payout) across WON/LOST/VOID bets in range. Excludes still-PENDING stakes. */
  ggrCents: number;
  statusBreakdown: StatusBreakdownEntry[];
}

export interface StaffActivityEntry {
  actorUsername: string;
  settlementCount: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private dateFilter(range: ReportRange) {
    if (!range.from && !range.to) return undefined;
    return {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    };
  }

  async getSummary(brandId: string, range: ReportRange): Promise<ReportSummary> {
    const createdAt = this.dateFilter(range);
    const where = { brandId, ...(createdAt ? { createdAt } : {}) };

    const [betCount, totalStakeAgg, statusGroups] = await Promise.all([
      this.prisma.bet.count({ where }),
      this.prisma.bet.aggregate({ where, _sum: { stakeCents: true } }),
      this.prisma.bet.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { stakeCents: true, settledPayoutCents: true },
      }),
    ]);

    const statusBreakdown: StatusBreakdownEntry[] = statusGroups.map((group) => ({
      status: group.status,
      count: group._count._all,
      stakeCents: group._sum.stakeCents ?? 0,
    }));

    const settledGroups = statusGroups.filter((group) => group.status !== 'PENDING');
    const settledBetCount = settledGroups.reduce((sum, group) => sum + group._count._all, 0);
    const settledStakeCents = settledGroups.reduce(
      (sum, group) => sum + (group._sum.stakeCents ?? 0),
      0,
    );
    const settledPayoutCents = settledGroups.reduce(
      (sum, group) => sum + (group._sum.settledPayoutCents ?? 0),
      0,
    );

    return {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
      betCount,
      totalStakeCents: totalStakeAgg._sum.stakeCents ?? 0,
      settledBetCount,
      settledStakeCents,
      settledPayoutCents,
      ggrCents: settledStakeCents - settledPayoutCents,
      statusBreakdown,
    };
  }

  /** How many selections each staff member has settled - a proxy for trader activity, not a judgement of quality. */
  async getStaffActivity(brandId: string, range: ReportRange): Promise<StaffActivityEntry[]> {
    const createdAt = this.dateFilter(range);
    const groups = await this.prisma.auditLogEntry.groupBy({
      by: ['actorUsername'],
      where: { brandId, action: 'SELECTION_SETTLED', ...(createdAt ? { createdAt } : {}) },
      _count: { _all: true },
    });

    return groups
      .map((group) => ({ actorUsername: group.actorUsername, settlementCount: group._count._all }))
      .sort((a, b) => b.settlementCount - a.settlementCount);
  }
}

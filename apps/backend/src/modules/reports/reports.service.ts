import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ReportRange {
  from?: Date;
  to?: Date;
}

export type ReportGranularity = 'day' | 'week' | 'month';
const GRANULARITIES: ReportGranularity[] = ['day', 'week', 'month'];

export interface TimeSeriesPoint {
  bucket: string;
  count: number;
}

export interface GgrTimeSeriesPoint {
  bucket: string;
  ggrCents: number;
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

  private assertGranularity(granularity: ReportGranularity): void {
    if (!GRANULARITIES.includes(granularity)) {
      throw new BadRequestException(`Invalid granularity: ${granularity}`);
    }
  }

  private rangeSql(column: Prisma.Sql, range: ReportRange): Prisma.Sql {
    const clauses: Prisma.Sql[] = [];
    if (range.from) clauses.push(Prisma.sql`${column} >= ${range.from}`);
    if (range.to) clauses.push(Prisma.sql`${column} <= ${range.to}`);
    return clauses.length > 0 ? Prisma.sql`AND ${Prisma.join(clauses, ' AND ')}` : Prisma.empty;
  }

  /** New player registrations bucketed by day/week/month - `User.createdAt`, the only registration timestamp that exists today. */
  async getRegistrationsTimeSeries(
    brandId: string,
    range: ReportRange,
    granularity: ReportGranularity,
  ): Promise<TimeSeriesPoint[]> {
    this.assertGranularity(granularity);

    const rows = await this.prisma.$queryRaw<{ bucket: Date; count: bigint }[]>(Prisma.sql`
      SELECT date_trunc(${granularity}, "createdAt") AS bucket, COUNT(*)::bigint AS count
      FROM "users"
      WHERE "brandId" = ${brandId}
      ${this.rangeSql(Prisma.sql`"createdAt"`, range)}
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    return rows.map((row) => ({ bucket: row.bucket.toISOString(), count: Number(row.count) }));
  }

  /**
   * GGR bucketed by day/week/month, bucketed on `settledAt` (when the
   * revenue was actually realized) rather than `createdAt` (when the
   * stake was placed) - only settled bets (WON/LOST/VOID) contribute,
   * same definition as getSummary's ggrCents.
   */
  async getGgrTimeSeries(
    brandId: string,
    range: ReportRange,
    granularity: ReportGranularity,
  ): Promise<GgrTimeSeriesPoint[]> {
    this.assertGranularity(granularity);

    const rows = await this.prisma.$queryRaw<{ bucket: Date; ggr_cents: bigint }[]>(Prisma.sql`
      SELECT
        date_trunc(${granularity}, "settledAt") AS bucket,
        COALESCE(SUM("stakeCents" - COALESCE("settledPayoutCents", 0)), 0)::bigint AS ggr_cents
      FROM "bets"
      WHERE "brandId" = ${brandId} AND "status" != 'PENDING' AND "settledAt" IS NOT NULL
      ${this.rangeSql(Prisma.sql`"settledAt"`, range)}
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    return rows.map((row) => ({ bucket: row.bucket.toISOString(), ggrCents: Number(row.ggr_cents) }));
  }
}

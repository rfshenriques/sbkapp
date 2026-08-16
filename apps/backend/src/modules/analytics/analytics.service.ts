import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AnalyticsEventEntryDto } from './dto/ingest-analytics-events.dto';

export interface AnalyticsRange {
  from?: Date;
  to?: Date;
}

export interface LiveAnalyticsSnapshot {
  /** Distinct sessions (anonymous or logged in) with an event inside the window - "people on the site right now". */
  activeSessions: number;
  /** Distinct logged-in users with an event inside the window. */
  loggedInUsers: number;
  /** Raw event volume in the last 60s - a simple activity pulse, not windowed like the two counts above. */
  eventsLastMinute: number;
  windowMinutes: number;
}

export interface AnalyticsEventTypeCount {
  type: string;
  count: number;
}

export interface AnalyticsPathCount {
  path: string;
  count: number;
}

export interface AnalyticsSummary {
  from: string | null;
  to: string | null;
  totalEvents: number;
  eventCounts: AnalyticsEventTypeCount[];
  topPaths: AnalyticsPathCount[];
}

/** How far back "live" looks - long enough that a slow page doesn't drop out between polls, short enough to still mean "right now". */
const LIVE_WINDOW_MS = 5 * 60 * 1000;
const TOP_PATHS_LIMIT = 10;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    brandId: string,
    sessionId: string,
    userId: string | null,
    events: AnalyticsEventEntryDto[],
  ): Promise<void> {
    if (events.length === 0) return;

    await this.prisma.analyticsEvent.createMany({
      data: events.map((event) => ({
        brandId,
        sessionId,
        userId: userId ?? undefined,
        type: event.type,
        path: event.path,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
      })),
    });
  }

  async getLiveSnapshot(brandId: string): Promise<LiveAnalyticsSnapshot> {
    const since = new Date(Date.now() - LIVE_WINDOW_MS);
    const oneMinuteAgo = new Date(Date.now() - 60_000);

    const [activeSessions, loggedInUsers, eventsLastMinute] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { brandId, createdAt: { gte: since } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
      this.prisma.analyticsEvent.findMany({
        where: { brandId, createdAt: { gte: since }, userId: { not: null } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.analyticsEvent.count({ where: { brandId, createdAt: { gte: oneMinuteAgo } } }),
    ]);

    return {
      activeSessions: activeSessions.length,
      loggedInUsers: loggedInUsers.length,
      eventsLastMinute,
      windowMinutes: LIVE_WINDOW_MS / 60_000,
    };
  }

  async getSummary(brandId: string, range: AnalyticsRange): Promise<AnalyticsSummary> {
    const createdAt = this.dateFilter(range);
    const where = { brandId, ...(createdAt ? { createdAt } : {}) };

    const [totalEvents, typeGroups, pathGroups] = await Promise.all([
      this.prisma.analyticsEvent.count({ where }),
      this.prisma.analyticsEvent.groupBy({ by: ['type'], where, _count: { _all: true } }),
      this.prisma.analyticsEvent.groupBy({
        by: ['path'],
        where: { ...where, type: 'PAGE_VIEW', path: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const eventCounts = typeGroups
      .map((group) => ({ type: group.type, count: group._count._all }))
      .sort((a, b) => b.count - a.count);

    const topPaths = pathGroups
      .map((group) => ({ path: group.path ?? '', count: group._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_PATHS_LIMIT);

    return {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
      totalEvents,
      eventCounts,
      topPaths,
    };
  }

  private dateFilter(range: AnalyticsRange) {
    if (!range.from && !range.to) return undefined;
    return {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    };
  }
}

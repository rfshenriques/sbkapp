import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let moduleRef: TestingModule;
  let analyticsService: AnalyticsService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let testBrandId: string;
  let otherBrandId: string;

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Test Brand ${unique}`, slug: `test-brand-analytics-${unique}` },
    });
    testBrandId = brand.id;
    const otherBrand = await setupPrisma.brand.create({
      data: { name: `Other Brand ${unique}`, slug: `other-brand-analytics-${unique}` },
    });
    otherBrandId = otherBrand.id;
  });

  afterAll(async () => {
    await setupPrisma.analyticsEvent.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await setupPrisma.brand.delete({ where: { id: testBrandId } });
    await setupPrisma.brand.delete({ where: { id: otherBrandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [AnalyticsService, PrismaService],
    }).compile();
    await moduleRef.init();

    analyticsService = moduleRef.get(AnalyticsService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.analyticsEvent.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await moduleRef.close();
  });

  describe('ingest', () => {
    it('stores every event in the batch, attributed to the given session/user', async () => {
      await analyticsService.ingest(testBrandId, 'session-1', 'user-1', [
        { type: 'PAGE_VIEW', path: '/' },
        { type: 'LOGIN' },
      ]);

      const rows = await prisma.analyticsEvent.findMany({ where: { brandId: testBrandId } });
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.sessionId === 'session-1' && row.userId === 'user-1')).toBe(true);
    });

    it('leaves userId null for anonymous events', async () => {
      await analyticsService.ingest(testBrandId, 'session-anon', null, [{ type: 'PAGE_VIEW', path: '/' }]);

      const [row] = await prisma.analyticsEvent.findMany({ where: { brandId: testBrandId } });
      expect(row?.userId).toBeNull();
    });

    it('is a no-op for an empty batch', async () => {
      await analyticsService.ingest(testBrandId, 'session-1', null, []);
      const rows = await prisma.analyticsEvent.findMany({ where: { brandId: testBrandId } });
      expect(rows).toHaveLength(0);
    });
  });

  describe('getLiveSnapshot', () => {
    it('counts distinct sessions and logged-in users active in the live window, excluding other brands', async () => {
      await analyticsService.ingest(testBrandId, 'session-1', 'user-1', [{ type: 'PAGE_VIEW', path: '/' }]);
      await analyticsService.ingest(testBrandId, 'session-1', 'user-1', [{ type: 'CLICK' }]);
      await analyticsService.ingest(testBrandId, 'session-2', null, [{ type: 'PAGE_VIEW', path: '/live' }]);
      await analyticsService.ingest(otherBrandId, 'session-other', 'user-other', [{ type: 'PAGE_VIEW', path: '/' }]);

      const snapshot = await analyticsService.getLiveSnapshot(testBrandId);

      expect(snapshot.activeSessions).toBe(2);
      expect(snapshot.loggedInUsers).toBe(1);
      expect(snapshot.eventsLastMinute).toBeGreaterThanOrEqual(3);
    });

    it('excludes events older than the live window', async () => {
      const old = new Date(Date.now() - 10 * 60 * 1000);
      await prisma.analyticsEvent.create({
        data: { brandId: testBrandId, type: 'PAGE_VIEW', sessionId: 'stale-session', createdAt: old },
      });

      const snapshot = await analyticsService.getLiveSnapshot(testBrandId);

      expect(snapshot.activeSessions).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('counts events by type and ranks the most-viewed paths', async () => {
      await analyticsService.ingest(testBrandId, 'session-1', null, [
        { type: 'PAGE_VIEW', path: '/' },
        { type: 'PAGE_VIEW', path: '/' },
        { type: 'PAGE_VIEW', path: '/live' },
        { type: 'BET_PLACED' },
      ]);

      const summary = await analyticsService.getSummary(testBrandId, {});

      expect(summary.totalEvents).toBe(4);
      expect(summary.eventCounts).toEqual(
        expect.arrayContaining([
          { type: 'PAGE_VIEW', count: 3 },
          { type: 'BET_PLACED', count: 1 },
        ]),
      );
      expect(summary.topPaths[0]).toEqual({ path: '/', count: 2 });
    });

    it('only counts events within the given range', async () => {
      const outOfRange = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await prisma.analyticsEvent.create({
        data: { brandId: testBrandId, type: 'PAGE_VIEW', sessionId: 'old', createdAt: outOfRange },
      });
      await analyticsService.ingest(testBrandId, 'session-1', null, [{ type: 'PAGE_VIEW', path: '/' }]);

      const summary = await analyticsService.getSummary(testBrandId, {
        from: new Date(Date.now() - 60 * 60 * 1000),
      });

      expect(summary.totalEvents).toBe(1);
    });
  });
});

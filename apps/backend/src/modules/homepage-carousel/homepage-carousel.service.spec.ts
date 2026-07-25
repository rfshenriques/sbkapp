import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { HomepageCarouselService } from './homepage-carousel.service';

describe('HomepageCarouselService', () => {
  let moduleRef: TestingModule;
  let service: HomepageCarouselService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-homepage-carousel-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-homepage-carousel-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_homepage_carousel', brandId: brandAId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [HomepageCarouselService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(HomepageCarouselService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
    await prisma.homepageCarouselConfig.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('returns auto-scroll-off defaults when no config row exists yet', async () => {
    expect(await service.getConfig(brandAId)).toEqual({ enabled: false, autoScrollSeconds: 6 });
  });

  it('sets a config and reads it back', async () => {
    await service.setConfig(brandAId, { enabled: true, autoScrollSeconds: 10 }, TEST_ACTOR);

    expect(await service.getConfig(brandAId)).toEqual({ enabled: true, autoScrollSeconds: 10 });
  });

  it('is idempotent - setting a config again updates it in place rather than duplicating', async () => {
    await service.setConfig(brandAId, { enabled: true, autoScrollSeconds: 5 }, TEST_ACTOR);
    await service.setConfig(brandAId, { enabled: true, autoScrollSeconds: 12 }, TEST_ACTOR);

    expect(await prisma.homepageCarouselConfig.count({ where: { brandId: brandAId } })).toBe(1);
    expect((await service.getConfig(brandAId)).autoScrollSeconds).toBe(12);
  });

  it('records an audit entry for each set', async () => {
    await service.setConfig(brandAId, { enabled: true, autoScrollSeconds: 8 }, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({ where: { actorUsername: TEST_ACTOR.username } });
    expect(entries.map((entry) => entry.action)).toEqual(['HOMEPAGE_CAROUSEL_CONFIG_SET']);
  });

  it('is isolated per brand', async () => {
    await service.setConfig(brandAId, { enabled: true, autoScrollSeconds: 9 }, TEST_ACTOR);

    expect(await service.getConfig(brandBId)).toEqual({ enabled: false, autoScrollSeconds: 6 });
  });
});

import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { CompetitionQuicklinkService } from './competition-quicklink.service';

describe('CompetitionQuicklinkService', () => {
  let moduleRef: TestingModule;
  let service: CompetitionQuicklinkService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;
  let OTHER_BRAND_ACTOR: AuditActor;

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_cms_quicklinks', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_cms_quicklinks_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [CompetitionQuicklinkService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(CompetitionQuicklinkService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.competitionQuicklink.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('sets a quicklink and lists it back, lowest order first', async () => {
    await service.setQuicklink(brandAId, 'La Liga - Spain', 2, TEST_ACTOR);
    await service.setQuicklink(brandAId, 'ATP Finals', 0, TEST_ACTOR);
    await service.setQuicklink(brandAId, 'EPL', 1, TEST_ACTOR);

    const quicklinks = await service.listQuicklinks(brandAId);
    expect(quicklinks.map((quicklink) => quicklink.competition)).toEqual([
      'ATP Finals',
      'EPL',
      'La Liga - Spain',
    ]);
  });

  it('is idempotent - setting an order for an already-listed competition updates it instead of duplicating', async () => {
    await service.setQuicklink(brandAId, 'EPL', 5, TEST_ACTOR);
    await service.setQuicklink(brandAId, 'EPL', 0, TEST_ACTOR);

    const quicklinks = await prisma.competitionQuicklink.findMany({
      where: { brandId: brandAId, competition: 'EPL' },
    });
    expect(quicklinks).toHaveLength(1);
    expect(quicklinks[0]?.order).toBe(0);
  });

  it('removing a quicklink deletes it', async () => {
    const quicklink = await service.setQuicklink(brandAId, 'EPL', 0, TEST_ACTOR);
    await service.removeQuicklink(brandAId, quicklink.id, TEST_ACTOR);

    expect(await service.listQuicklinks(brandAId)).toEqual([]);
  });

  it('removing a nonexistent quicklink throws NotFoundException', async () => {
    await expect(
      service.removeQuicklink(brandAId, 'does-not-exist', TEST_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records audit entries for set and remove', async () => {
    const quicklink = await service.setQuicklink(brandAId, 'EPL', 0, TEST_ACTOR);
    await service.removeQuicklink(brandAId, quicklink.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'COMPETITION_QUICKLINK_SET',
      'COMPETITION_QUICKLINK_REMOVED',
    ]);
    expect(entries[0]?.brandId).toBe(brandAId);
    expect(entries[0]?.metadata).toMatchObject({ competition: 'EPL', order: 0 });
  });

  it('is isolated per brand: the same competition quicklinked in one brand does not affect another', async () => {
    await service.setQuicklink(brandAId, 'EPL', 0, TEST_ACTOR);

    expect(await service.listQuicklinks(brandAId)).toHaveLength(1);
    expect(await service.listQuicklinks(brandBId)).toHaveLength(0);
  });

  it("a brand can never remove another brand's quicklink, even by guessing its id", async () => {
    const quicklink = await service.setQuicklink(brandAId, 'EPL', 0, TEST_ACTOR);

    await expect(
      service.removeQuicklink(brandBId, quicklink.id, OTHER_BRAND_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.listQuicklinks(brandAId)).toHaveLength(1);
  });
});

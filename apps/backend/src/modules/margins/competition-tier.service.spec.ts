import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { CompetitionTierService } from './competition-tier.service';

describe('CompetitionTierService', () => {
  let moduleRef: TestingModule;
  let service: CompetitionTierService;
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
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-tier-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-tier-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_trading_tiers', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_trading_tiers_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [CompetitionTierService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(CompetitionTierService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.competitionTier.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('sets a tier and lists it back', async () => {
    await service.setTier(brandAId, 'EPL', 1, TEST_ACTOR);
    await service.setTier(brandAId, 'League Two', 4, TEST_ACTOR);

    const tiers = await service.listTiers(brandAId);
    expect(tiers.map((row) => [row.competition, row.tier])).toEqual([
      ['EPL', 1],
      ['League Two', 4],
    ]);
  });

  it('is idempotent - setting a tier for an already-tiered competition updates it instead of duplicating', async () => {
    await service.setTier(brandAId, 'EPL', 1, TEST_ACTOR);
    await service.setTier(brandAId, 'EPL', 2, TEST_ACTOR);

    const rows = await prisma.competitionTier.findMany({
      where: { brandId: brandAId, competition: 'EPL' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tier).toBe(2);
  });

  it('removing a tier deletes it', async () => {
    const row = await service.setTier(brandAId, 'EPL', 1, TEST_ACTOR);
    await service.removeTier(brandAId, row.id, TEST_ACTOR);

    expect(await service.listTiers(brandAId)).toEqual([]);
  });

  it('removing a nonexistent tier throws NotFoundException', async () => {
    await expect(service.removeTier(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records audit entries for set and remove', async () => {
    const row = await service.setTier(brandAId, 'EPL', 1, TEST_ACTOR);
    await service.removeTier(brandAId, row.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual(['COMPETITION_TIER_SET', 'COMPETITION_TIER_REMOVED']);
    expect(entries[0]?.metadata).toMatchObject({ competition: 'EPL', tier: 1 });
  });

  it('is isolated per brand', async () => {
    await service.setTier(brandAId, 'EPL', 1, TEST_ACTOR);

    expect(await service.listTiers(brandAId)).toHaveLength(1);
    expect(await service.listTiers(brandBId)).toHaveLength(0);
  });

  it("a brand can never remove another brand's tier, even by guessing its id", async () => {
    const row = await service.setTier(brandAId, 'EPL', 1, TEST_ACTOR);

    await expect(service.removeTier(brandBId, row.id, OTHER_BRAND_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await service.listTiers(brandAId)).toHaveLength(1);
  });
});

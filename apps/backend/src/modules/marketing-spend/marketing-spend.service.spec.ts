import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { MarketingSpendService } from './marketing-spend.service';

describe('MarketingSpendService', () => {
  let moduleRef: TestingModule;
  let service: MarketingSpendService;
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
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_marketing_spend', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_marketing_spend_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [MarketingSpendService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(MarketingSpendService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.marketingSpend.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('creates a spend entry and lists it back, most recent date first', async () => {
    await service.create(brandAId, { date: new Date('2026-07-01'), channel: 'Google Ads', amountCents: 10_000 }, TEST_ACTOR);
    await service.create(brandAId, { date: new Date('2026-07-05'), channel: 'Affiliates', amountCents: 5_000 }, TEST_ACTOR);

    const entries = await service.list(brandAId, {});
    expect(entries.map((entry) => entry.channel)).toEqual(['Affiliates', 'Google Ads']);
    expect(entries[0]?.createdByUsername).toBe(TEST_ACTOR.username);
  });

  it('filters by date range', async () => {
    await service.create(brandAId, { date: new Date('2026-06-01'), channel: 'Google Ads', amountCents: 10_000 }, TEST_ACTOR);
    await service.create(brandAId, { date: new Date('2026-07-15'), channel: 'Affiliates', amountCents: 5_000 }, TEST_ACTOR);

    const entries = await service.list(brandAId, { from: new Date('2026-07-01') });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.channel).toBe('Affiliates');
  });

  it('removing an entry deletes it', async () => {
    const spend = await service.create(brandAId, { date: new Date('2026-07-01'), channel: 'Google Ads', amountCents: 10_000 }, TEST_ACTOR);
    await service.remove(brandAId, spend.id, TEST_ACTOR);

    expect(await service.list(brandAId, {})).toEqual([]);
  });

  it('removing a nonexistent entry throws NotFoundException', async () => {
    await expect(service.remove(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records audit entries for create and remove', async () => {
    const spend = await service.create(brandAId, { date: new Date('2026-07-01'), channel: 'Google Ads', amountCents: 10_000 }, TEST_ACTOR);
    await service.remove(brandAId, spend.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'MARKETING_SPEND_CREATED',
      'MARKETING_SPEND_REMOVED',
    ]);
    expect(entries[0]?.metadata).toMatchObject({ channel: 'Google Ads', amountCents: 10_000 });
  });

  it('is isolated per brand: an entry in one brand does not appear in another', async () => {
    await service.create(brandAId, { date: new Date('2026-07-01'), channel: 'Google Ads', amountCents: 10_000 }, TEST_ACTOR);

    expect(await service.list(brandAId, {})).toHaveLength(1);
    expect(await service.list(brandBId, {})).toHaveLength(0);
  });

  it("a brand can never remove another brand's entry, even by guessing its id", async () => {
    const spend = await service.create(brandAId, { date: new Date('2026-07-01'), channel: 'Google Ads', amountCents: 10_000 }, TEST_ACTOR);

    await expect(service.remove(brandBId, spend.id, OTHER_BRAND_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await service.list(brandAId, {})).toHaveLength(1);
  });
});

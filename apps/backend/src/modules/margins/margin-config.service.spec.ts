import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { MarginConfigService } from './margin-config.service';

describe('MarginConfigService', () => {
  let moduleRef: TestingModule;
  let service: MarginConfigService;
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
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-margin-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-margin-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_trading_margins', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_trading_margins_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [MarginConfigService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(MarginConfigService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.marginConfig.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('sets a margin and lists it back', async () => {
    await service.setMargin(brandAId, 'Football', 'Match Result', 1, 20, TEST_ACTOR);
    await service.setMargin(brandAId, 'Football', 'Match Result', 2, 15, TEST_ACTOR);

    const rows = await service.listMargins(brandAId);
    expect(rows.map((row) => [row.sport, row.marketName, row.tier, row.marginPercent])).toEqual([
      ['Football', 'Match Result', 1, 20],
      ['Football', 'Match Result', 2, 15],
    ]);
  });

  it('is idempotent - setting a margin for an already-configured (sport, marketName, tier) triple updates it', async () => {
    await service.setMargin(brandAId, 'Football', 'Match Result', 1, 20, TEST_ACTOR);
    await service.setMargin(brandAId, 'Football', 'Match Result', 1, 25, TEST_ACTOR);

    const rows = await prisma.marginConfig.findMany({
      where: { brandId: brandAId, sport: 'Football', marketName: 'Match Result', tier: 1 },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.marginPercent).toBe(25);
  });

  it('the same market/tier can carry a different margin per sport', async () => {
    await service.setMargin(brandAId, 'Football', 'Match Result', 1, 20, TEST_ACTOR);
    await service.setMargin(brandAId, 'Tennis', 'Match Result', 1, 5, TEST_ACTOR);

    const rows = await service.listMargins(brandAId);
    expect(rows.map((row) => [row.sport, row.marginPercent])).toEqual([
      ['Football', 20],
      ['Tennis', 5],
    ]);
  });

  it('removing a margin config deletes it', async () => {
    const row = await service.setMargin(brandAId, 'Football', 'Match Result', 1, 20, TEST_ACTOR);
    await service.removeMargin(brandAId, row.id, TEST_ACTOR);

    expect(await service.listMargins(brandAId)).toEqual([]);
  });

  it('removing a nonexistent margin config throws NotFoundException', async () => {
    await expect(service.removeMargin(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records audit entries for set and remove', async () => {
    const row = await service.setMargin(brandAId, 'Football', 'Match Result', 1, 20, TEST_ACTOR);
    await service.removeMargin(brandAId, row.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual(['MARGIN_CONFIG_SET', 'MARGIN_CONFIG_REMOVED']);
    expect(entries[0]?.metadata).toMatchObject({
      sport: 'Football',
      marketName: 'Match Result',
      tier: 1,
      marginPercent: 20,
    });
  });

  it('is isolated per brand', async () => {
    await service.setMargin(brandAId, 'Football', 'Match Result', 1, 20, TEST_ACTOR);

    expect(await service.listMargins(brandAId)).toHaveLength(1);
    expect(await service.listMargins(brandBId)).toHaveLength(0);
  });

  it("a brand can never remove another brand's margin config, even by guessing its id", async () => {
    const row = await service.setMargin(brandAId, 'Football', 'Match Result', 1, 20, TEST_ACTOR);

    await expect(service.removeMargin(brandBId, row.id, OTHER_BRAND_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await service.listMargins(brandAId)).toHaveLength(1);
  });
});

import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { generateStandardLadder } from './odds-ladder';
import { OddsLadderService } from './odds-ladder.service';

describe('OddsLadderService', () => {
  let moduleRef: TestingModule;
  let service: OddsLadderService;
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
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-odds-ladder-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-odds-ladder-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_odds_ladder', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_odds_ladder_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [OddsLadderService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(OddsLadderService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.oddsLadderRung.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('adds a rung and lists it back in ascending order', async () => {
    await service.addRung(brandAId, 2.5, TEST_ACTOR);
    await service.addRung(brandAId, 1.5, TEST_ACTOR);

    const listed = await service.listRungs(brandAId);
    expect(listed.map((r) => r.value)).toEqual([1.5, 2.5]);
  });

  it('is idempotent - adding the same value twice does not duplicate it', async () => {
    await service.addRung(brandAId, 2.5, TEST_ACTOR);
    await service.addRung(brandAId, 2.5, TEST_ACTOR);

    expect(await service.listRungs(brandAId)).toHaveLength(1);
  });

  it('removing a rung deletes it', async () => {
    const rung = await service.addRung(brandAId, 2.5, TEST_ACTOR);
    await service.removeRung(brandAId, rung.id, TEST_ACTOR);

    expect(await service.listRungs(brandAId)).toEqual([]);
  });

  it('removing a nonexistent rung throws NotFoundException', async () => {
    await expect(service.removeRung(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("a brand can never remove another brand's rung, even by guessing its id", async () => {
    const rung = await service.addRung(brandAId, 2.5, TEST_ACTOR);

    await expect(service.removeRung(brandBId, rung.id, OTHER_BRAND_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await service.listRungs(brandAId)).toHaveLength(1);
  });

  it('regenerateStandard replaces the brand ladder with the full standard grid', async () => {
    await service.addRung(brandAId, 999, TEST_ACTOR);

    const result = await service.regenerateStandard(brandAId, TEST_ACTOR);

    const expected = generateStandardLadder();
    expect(result.map((r) => r.value)).toEqual(expected);
    expect(result.map((r) => r.value)).not.toContain(999);
  });

  it('regenerateStandard only touches the acting brand', async () => {
    await service.addRung(brandBId, 3.5, OTHER_BRAND_ACTOR);

    await service.regenerateStandard(brandAId, TEST_ACTOR);

    expect(await service.listRungValues(brandBId)).toEqual([3.5]);
  });

  it('records audit entries for add, remove, and regenerate', async () => {
    const rung = await service.addRung(brandAId, 2.5, TEST_ACTOR);
    await service.removeRung(brandAId, rung.id, TEST_ACTOR);
    await service.regenerateStandard(brandAId, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'ODDS_LADDER_RUNG_ADDED',
      'ODDS_LADDER_RUNG_REMOVED',
      'ODDS_LADDER_REGENERATED',
    ]);
  });

  it('is isolated per brand', async () => {
    await service.addRung(brandAId, 2.5, TEST_ACTOR);

    expect(await service.listRungs(brandAId)).toHaveLength(1);
    expect(await service.listRungs(brandBId)).toEqual([]);
  });
});

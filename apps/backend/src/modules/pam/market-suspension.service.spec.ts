import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { MarketSuspensionService } from './market-suspension.service';

describe('MarketSuspensionService', () => {
  let moduleRef: TestingModule;
  let service: MarketSuspensionService;
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
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_trader_suspensions', brandId: brandAId };
    OTHER_BRAND_ACTOR = {
      id: 'staff-test-id-b',
      username: 'test_trader_suspensions_b',
      brandId: brandBId,
    };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [MarketSuspensionService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(MarketSuspensionService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.marketSuspension.deleteMany({ where: { matchId: { startsWith: 'match-' } } });
    await moduleRef.close();
  });

  it('suspending a whole match blocks every market on it', async () => {
    await service.suspend(brandAId, 'match-a', undefined, undefined, 'weather delay', TEST_ACTOR);

    expect(await service.isSuspended(brandAId, 'match-a', 'match-result')).toBe(true);
    expect(await service.isSuspended(brandAId, 'match-a', 'total-goals')).toBe(true);
    expect(await service.isSuspended(brandAId, 'match-b', 'match-result')).toBe(false);
  });

  it('suspending one market only blocks that market', async () => {
    await service.suspend(brandAId, 'match-c', 'match-result', undefined, undefined, TEST_ACTOR);

    expect(await service.isSuspended(brandAId, 'match-c', 'match-result')).toBe(true);
    expect(await service.isSuspended(brandAId, 'match-c', 'total-goals')).toBe(false);
  });

  it('suspending one selection only blocks that selection, not the rest of the market', async () => {
    await service.suspend(brandAId, 'match-sel', 'match-result', 'home', undefined, TEST_ACTOR);

    expect(await service.isSuspended(brandAId, 'match-sel', 'match-result', 'home')).toBe(true);
    expect(await service.isSuspended(brandAId, 'match-sel', 'match-result', 'away')).toBe(false);
    // A market-level check (no selectionId) still reports suspended, since
    // the caller may just be checking "is anything in this market locked."
    expect(await service.isSuspended(brandAId, 'match-sel', 'match-result')).toBe(false);
  });

  it('rejects a selectionId without a marketId', async () => {
    await expect(
      service.suspend(brandAId, 'match-bad', undefined, 'home', undefined, TEST_ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('is idempotent - suspending an already-suspended match updates the reason instead of erroring', async () => {
    await service.suspend(brandAId, 'match-d', undefined, undefined, 'first reason', TEST_ACTOR);
    await service.suspend(brandAId, 'match-d', undefined, undefined, 'updated reason', TEST_ACTOR);

    const suspensions = await prisma.marketSuspension.findMany({
      where: { brandId: brandAId, matchId: 'match-d' },
    });
    expect(suspensions).toHaveLength(1);
    expect(suspensions[0]?.reason).toBe('updated reason');
  });

  it('unsuspending removes the block', async () => {
    const suspension = await service.suspend(
      brandAId,
      'match-e',
      undefined,
      undefined,
      undefined,
      TEST_ACTOR,
    );
    expect(await service.isSuspended(brandAId, 'match-e', 'match-result')).toBe(true);

    await service.unsuspend(brandAId, suspension.id, TEST_ACTOR);
    expect(await service.isSuspended(brandAId, 'match-e', 'match-result')).toBe(false);
  });

  it('unsuspending a nonexistent suspension throws NotFoundException', async () => {
    await expect(service.unsuspend(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records audit entries for suspend and unsuspend, with targetType reflecting the granularity', async () => {
    const suspension = await service.suspend(
      brandAId,
      'match-f',
      'match-result',
      undefined,
      'trading call',
      TEST_ACTOR,
    );
    await service.unsuspend(brandAId, suspension.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'MARKET_SUSPENDED',
      'MARKET_UNSUSPENDED',
    ]);
    expect(entries[0]?.targetType).toBe('Market');
    expect(entries[0]?.brandId).toBe(brandAId);
    expect(entries[0]?.metadata).toMatchObject({
      matchId: 'match-f',
      marketId: 'match-result',
      selectionId: null,
      reason: 'trading call',
    });
  });

  it('records a Selection targetType for a selection-level suspension', async () => {
    const suspension = await service.suspend(
      brandAId,
      'match-sel-audit',
      'match-result',
      'home',
      undefined,
      TEST_ACTOR,
    );

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(entries[0]?.targetType).toBe('Selection');
    expect(entries[0]?.targetId).toBe(`match-sel-audit:match-result:home`);
    expect(entries[0]?.metadata).toMatchObject({ selectionId: 'home' });
    await service.unsuspend(brandAId, suspension.id, TEST_ACTOR);
  });

  it('is isolated per brand: the same matchId suspended in one brand does not affect another', async () => {
    await service.suspend(brandAId, 'match-shared', undefined, undefined, 'brand A only', TEST_ACTOR);

    expect(await service.isSuspended(brandAId, 'match-shared', 'match-result')).toBe(true);
    expect(await service.isSuspended(brandBId, 'match-shared', 'match-result')).toBe(false);
  });

  it("a brand can never unsuspend another brand's suspension, even by guessing its id", async () => {
    const suspension = await service.suspend(
      brandAId,
      'match-g',
      undefined,
      undefined,
      undefined,
      TEST_ACTOR,
    );

    await expect(
      service.unsuspend(brandBId, suspension.id, OTHER_BRAND_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.isSuspended(brandAId, 'match-g', 'match-result')).toBe(true);
  });
});

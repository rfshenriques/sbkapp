import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { CompetitionSuspensionService } from './competition-suspension.service';

describe('CompetitionSuspensionService', () => {
  let moduleRef: TestingModule;
  let service: CompetitionSuspensionService;
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
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_competition_suspensions', brandId: brandAId };
    OTHER_BRAND_ACTOR = {
      id: 'staff-test-id-b',
      username: 'test_competition_suspensions_b',
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
      providers: [CompetitionSuspensionService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(CompetitionSuspensionService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.competitionSuspension.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('suspends a competition and lists it back', async () => {
    await service.suspend(brandAId, 'EPL', 'integrity concern', TEST_ACTOR);

    expect(await service.isSuspended(brandAId, 'EPL')).toBe(true);
    expect(await service.isSuspended(brandAId, 'La Liga')).toBe(false);

    const listed = await service.listSuspensions(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.reason).toBe('integrity concern');
  });

  it('is idempotent - suspending an already-suspended competition updates the reason instead of duplicating', async () => {
    await service.suspend(brandAId, 'EPL', 'first reason', TEST_ACTOR);
    await service.suspend(brandAId, 'EPL', 'updated reason', TEST_ACTOR);

    const listed = await service.listSuspensions(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.reason).toBe('updated reason');
  });

  it('unsuspending removes the block', async () => {
    const suspension = await service.suspend(brandAId, 'EPL', undefined, TEST_ACTOR);
    await service.unsuspend(brandAId, suspension.id, TEST_ACTOR);

    expect(await service.isSuspended(brandAId, 'EPL')).toBe(false);
  });

  it('unsuspending a nonexistent suspension throws NotFoundException', async () => {
    await expect(service.unsuspend(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records audit entries for suspend and unsuspend', async () => {
    const suspension = await service.suspend(brandAId, 'EPL', 'trading call', TEST_ACTOR);
    await service.unsuspend(brandAId, suspension.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'COMPETITION_SUSPENDED',
      'COMPETITION_UNSUSPENDED',
    ]);
    expect(entries[0]?.targetType).toBe('Competition');
    expect(entries[0]?.metadata).toMatchObject({ competition: 'EPL', reason: 'trading call' });
  });

  it('is isolated per brand: the same competition suspended in one brand does not affect another', async () => {
    await service.suspend(brandAId, 'EPL', undefined, TEST_ACTOR);

    expect(await service.isSuspended(brandAId, 'EPL')).toBe(true);
    expect(await service.isSuspended(brandBId, 'EPL')).toBe(false);
  });

  it("a brand can never unsuspend another brand's suspension, even by guessing its id", async () => {
    const suspension = await service.suspend(brandAId, 'EPL', undefined, TEST_ACTOR);

    await expect(
      service.unsuspend(brandBId, suspension.id, OTHER_BRAND_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.isSuspended(brandAId, 'EPL')).toBe(true);
  });
});

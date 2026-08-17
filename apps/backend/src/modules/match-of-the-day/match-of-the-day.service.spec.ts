import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { MatchOfTheDayService } from './match-of-the-day.service';

describe('MatchOfTheDayService', () => {
  let moduleRef: TestingModule;
  let service: MatchOfTheDayService;
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
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-motd-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-motd-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_motd', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_motd_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [MatchOfTheDayService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(MatchOfTheDayService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } } });
    await prisma.matchOfTheDay.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('starts empty for a brand that has never configured one', async () => {
    expect(await service.list(brandAId)).toEqual([]);
    expect(await service.listActiveForViewer(brandAId)).toEqual([]);
  });

  it('adds an entry, enabled by default with no scheduling window, at the front of sortOrder', async () => {
    const entry = await service.add(brandAId, { matchId: 'match-1' }, TEST_ACTOR);

    expect(entry).toMatchObject({ brandId: brandAId, matchId: 'match-1', enabled: true, sortOrder: 0, startAt: null, endAt: null });
    expect(await service.listActiveForViewer(brandAId)).toHaveLength(1);
  });

  it('appends further adds in sortOrder, oldest first', async () => {
    await service.add(brandAId, { matchId: 'match-1' }, TEST_ACTOR);
    await service.add(brandAId, { matchId: 'match-2' }, TEST_ACTOR);
    await service.add(brandAId, { matchId: 'match-3' }, TEST_ACTOR);

    const list = await service.list(brandAId);
    expect(list.map((entry) => entry.matchId)).toEqual(['match-1', 'match-2', 'match-3']);
    expect(list.map((entry) => entry.sortOrder)).toEqual([0, 1, 2]);
  });

  it('a disabled entry never shows to viewers even with no scheduling window', async () => {
    await service.add(brandAId, { matchId: 'match-1', enabled: false }, TEST_ACTOR);

    expect(await service.listActiveForViewer(brandAId)).toEqual([]);
  });

  it('an entry scheduled to start in the future is hidden from viewers until then', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await service.add(brandAId, { matchId: 'match-1', startAt: future }, TEST_ACTOR);

    expect(await service.listActiveForViewer(brandAId)).toEqual([]);
    // Still visible to staff via list() regardless of scheduling.
    expect(await service.list(brandAId)).toHaveLength(1);
  });

  it('an entry scheduled to have already ended is hidden from viewers', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await service.add(brandAId, { matchId: 'match-1', endAt: past }, TEST_ACTOR);

    expect(await service.listActiveForViewer(brandAId)).toEqual([]);
  });

  it('an entry within its scheduling window shows to viewers', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await service.add(brandAId, { matchId: 'match-1', startAt: past, endAt: future }, TEST_ACTOR);

    expect(await service.listActiveForViewer(brandAId)).toHaveLength(1);
  });

  it('updates matchId/enabled/scheduling fields in place', async () => {
    const entry = await service.add(brandAId, { matchId: 'match-1' }, TEST_ACTOR);

    const updated = await service.update(brandAId, entry.id, { matchId: 'match-2', enabled: false }, TEST_ACTOR);

    expect(updated.matchId).toBe('match-2');
    expect(updated.enabled).toBe(false);
  });

  it('rejects updating another brand\'s entry, even with a valid id', async () => {
    const entry = await service.add(brandAId, { matchId: 'match-1' }, TEST_ACTOR);

    await expect(service.update(brandBId, entry.id, { matchId: 'match-2' }, OTHER_BRAND_ACTOR)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('removes an entry', async () => {
    const entry = await service.add(brandAId, { matchId: 'match-1' }, TEST_ACTOR);

    await service.remove(brandAId, entry.id, TEST_ACTOR);

    expect(await service.list(brandAId)).toEqual([]);
  });

  it('rejects removing another brand\'s entry', async () => {
    const entry = await service.add(brandAId, { matchId: 'match-1' }, TEST_ACTOR);

    await expect(service.remove(brandBId, entry.id, OTHER_BRAND_ACTOR)).rejects.toThrow(NotFoundException);
  });

  it('reorders entries to a new sortOrder', async () => {
    const first = await service.add(brandAId, { matchId: 'match-1' }, TEST_ACTOR);
    const second = await service.add(brandAId, { matchId: 'match-2' }, TEST_ACTOR);

    await service.reorder(brandAId, [second.id, first.id], TEST_ACTOR);

    const list = await service.list(brandAId);
    expect(list.map((entry) => entry.matchId)).toEqual(['match-2', 'match-1']);
  });

  it('rejects a reorder with a partial or foreign id set', async () => {
    const first = await service.add(brandAId, { matchId: 'match-1' }, TEST_ACTOR);
    await service.add(brandAId, { matchId: 'match-2' }, TEST_ACTOR);

    await expect(service.reorder(brandAId, [first.id], TEST_ACTOR)).rejects.toThrow(BadRequestException);
  });

  it('records an audit entry for add/update/remove/reorder', async () => {
    const entry = await service.add(brandAId, { matchId: 'match-1' }, TEST_ACTOR);
    await service.update(brandAId, entry.id, { matchId: 'match-2' }, TEST_ACTOR);
    await service.reorder(brandAId, [entry.id], TEST_ACTOR);
    await service.remove(brandAId, entry.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'MATCH_OF_THE_DAY_ADDED',
      'MATCH_OF_THE_DAY_UPDATED',
      'MATCH_OF_THE_DAY_REORDERED',
      'MATCH_OF_THE_DAY_REMOVED',
    ]);
  });

  it('is isolated per brand', async () => {
    await service.add(brandAId, { matchId: 'match-1' }, TEST_ACTOR);

    expect(await service.list(brandBId)).toEqual([]);
    expect(await service.listActiveForViewer(brandBId)).toEqual([]);
  });
});

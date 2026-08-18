import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { TopNavItemService } from './top-nav-item.service';

describe('TopNavItemService', () => {
  let moduleRef: TestingModule;
  let service: TopNavItemService;
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
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-topnav-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-topnav-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_topnav', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_topnav_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [TopNavItemService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(TopNavItemService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } } });
    await prisma.topNavItem.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('starts empty for a brand that has never configured one', async () => {
    expect(await service.list(brandAId)).toEqual([]);
    expect(await service.listEnabled(brandAId)).toEqual([]);
  });

  it('adds a SPORT entry, enabled by default, at the front of sortOrder', async () => {
    const entry = await service.add(brandAId, { kind: 'SPORT', label: 'Football', sport: 'Football' }, TEST_ACTOR);

    expect(entry).toMatchObject({
      brandId: brandAId,
      kind: 'SPORT',
      label: 'Football',
      icon: 'STAR',
      sport: 'Football',
      competition: null,
      matchId: null,
      enabled: true,
      sortOrder: 0,
    });
    expect(await service.listEnabled(brandAId)).toHaveLength(1);
  });

  it('accepts a freely-chosen icon independent of kind, and lets it be changed later', async () => {
    const entry = await service.add(
      brandAId,
      { kind: 'COMPETITION', label: 'Premier League', competition: 'Premier League', icon: 'TROPHY' },
      TEST_ACTOR,
    );
    expect(entry.icon).toBe('TROPHY');

    const updated = await service.update(brandAId, entry.id, { icon: 'FIRE' }, TEST_ACTOR);
    expect(updated.icon).toBe('FIRE');
  });

  it('appends further adds in sortOrder, oldest first', async () => {
    await service.add(brandAId, { kind: 'TODAY', label: "Today's matches" }, TEST_ACTOR);
    await service.add(brandAId, { kind: 'TOMORROW', label: "Tomorrow's matches" }, TEST_ACTOR);
    await service.add(brandAId, { kind: 'SPORT', label: 'Tennis', sport: 'Tennis' }, TEST_ACTOR);

    const list = await service.list(brandAId);
    expect(list.map((entry) => entry.label)).toEqual(["Today's matches", "Tomorrow's matches", 'Tennis']);
    expect(list.map((entry) => entry.sortOrder)).toEqual([0, 1, 2]);
  });

  it('a disabled entry never shows to viewers', async () => {
    await service.add(brandAId, { kind: 'TODAY', label: "Today's matches", enabled: false }, TEST_ACTOR);

    expect(await service.listEnabled(brandAId)).toEqual([]);
  });

  it('rejects a SPORT entry with no sport', async () => {
    await expect(service.add(brandAId, { kind: 'SPORT', label: 'Football' }, TEST_ACTOR)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a COMPETITION entry with no competition', async () => {
    await expect(service.add(brandAId, { kind: 'COMPETITION', label: 'Premier League' }, TEST_ACTOR)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a MATCH entry with no matchId', async () => {
    await expect(service.add(brandAId, { kind: 'MATCH', label: 'Arsenal vs Chelsea' }, TEST_ACTOR)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('accepts TODAY/TOMORROW entries with no sport/competition/matchId', async () => {
    const today = await service.add(brandAId, { kind: 'TODAY', label: "Today's matches" }, TEST_ACTOR);
    const tomorrow = await service.add(brandAId, { kind: 'TOMORROW', label: "Tomorrow's matches" }, TEST_ACTOR);

    expect(today.sport).toBeNull();
    expect(tomorrow.sport).toBeNull();
  });

  it('updates label/enabled/sport fields in place', async () => {
    const entry = await service.add(brandAId, { kind: 'SPORT', label: 'Football', sport: 'Football' }, TEST_ACTOR);

    const updated = await service.update(brandAId, entry.id, { label: 'Soccer', enabled: false }, TEST_ACTOR);

    expect(updated.label).toBe('Soccer');
    expect(updated.enabled).toBe(false);
  });

  it('rejects switching kind to one whose required field is missing', async () => {
    const entry = await service.add(brandAId, { kind: 'SPORT', label: 'Football', sport: 'Football' }, TEST_ACTOR);

    await expect(service.update(brandAId, entry.id, { kind: 'COMPETITION' }, TEST_ACTOR)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("rejects updating another brand's entry, even with a valid id", async () => {
    const entry = await service.add(brandAId, { kind: 'TODAY', label: "Today's matches" }, TEST_ACTOR);

    await expect(service.update(brandBId, entry.id, { label: 'x' }, OTHER_BRAND_ACTOR)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('removes an entry', async () => {
    const entry = await service.add(brandAId, { kind: 'TODAY', label: "Today's matches" }, TEST_ACTOR);

    await service.remove(brandAId, entry.id, TEST_ACTOR);

    expect(await service.list(brandAId)).toEqual([]);
  });

  it("rejects removing another brand's entry", async () => {
    const entry = await service.add(brandAId, { kind: 'TODAY', label: "Today's matches" }, TEST_ACTOR);

    await expect(service.remove(brandBId, entry.id, OTHER_BRAND_ACTOR)).rejects.toThrow(NotFoundException);
  });

  it('reorders entries to a new sortOrder', async () => {
    const first = await service.add(brandAId, { kind: 'TODAY', label: "Today's matches" }, TEST_ACTOR);
    const second = await service.add(brandAId, { kind: 'TOMORROW', label: "Tomorrow's matches" }, TEST_ACTOR);

    await service.reorder(brandAId, [second.id, first.id], TEST_ACTOR);

    const list = await service.list(brandAId);
    expect(list.map((entry) => entry.id)).toEqual([second.id, first.id]);
  });

  it('rejects a reorder with a partial or foreign id set', async () => {
    const first = await service.add(brandAId, { kind: 'TODAY', label: "Today's matches" }, TEST_ACTOR);
    await service.add(brandAId, { kind: 'TOMORROW', label: "Tomorrow's matches" }, TEST_ACTOR);

    await expect(service.reorder(brandAId, [first.id], TEST_ACTOR)).rejects.toThrow(BadRequestException);
  });

  it('records an audit entry for add/update/remove/reorder', async () => {
    const entry = await service.add(brandAId, { kind: 'TODAY', label: "Today's matches" }, TEST_ACTOR);
    await service.update(brandAId, entry.id, { label: 'Today' }, TEST_ACTOR);
    await service.reorder(brandAId, [entry.id], TEST_ACTOR);
    await service.remove(brandAId, entry.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'TOP_NAV_ITEM_ADDED',
      'TOP_NAV_ITEM_UPDATED',
      'TOP_NAV_ITEM_REORDERED',
      'TOP_NAV_ITEM_REMOVED',
    ]);
  });

  it('is isolated per brand', async () => {
    await service.add(brandAId, { kind: 'TODAY', label: "Today's matches" }, TEST_ACTOR);

    expect(await service.list(brandBId)).toEqual([]);
    expect(await service.listEnabled(brandBId)).toEqual([]);
  });
});

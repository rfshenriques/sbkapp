import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { DisplayNamesService } from './display-names.service';

describe('DisplayNamesService', () => {
  let moduleRef: TestingModule;
  let service: DisplayNamesService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandId: string;
  let TEST_ACTOR: AuditActor;
  const testNames: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Test Brand Display Names ${unique}`, slug: `test-brand-display-names-${unique}` },
    });
    brandId = brand.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_cms_display_names', brandId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [DisplayNamesService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(DisplayNamesService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
    if (testNames.length > 0) {
      await prisma.displayNameOverride.deleteMany({ where: { rawName: { in: testNames } } });
      testNames.length = 0;
    }
    await moduleRef.close();
  });

  function uniqueName(prefix: string) {
    const name = `${prefix} ${randomUUID()}`;
    testNames.push(name);
    return name;
  }

  it('syncNames creates only genuinely new names for that entity type, with displayName left null', async () => {
    const name = uniqueName('UEFA Champions League Qualification');

    await service.syncNames('COMPETITION', [name]);
    const created = await prisma.displayNameOverride.findUnique({
      where: { entityType_rawName: { entityType: 'COMPETITION', rawName: name } },
    });
    expect(created?.displayName).toBeNull();
  });

  it('syncNames does not touch an existing row (or its displayName)', async () => {
    const name = uniqueName('Existing Competition');
    await prisma.displayNameOverride.create({
      data: { entityType: 'COMPETITION', rawName: name, displayName: 'Existing Override' },
    });

    await service.syncNames('COMPETITION', [name]);
    const row = await prisma.displayNameOverride.findUnique({
      where: { entityType_rawName: { entityType: 'COMPETITION', rawName: name } },
    });
    expect(row?.displayName).toBe('Existing Override');
  });

  it('the same raw name can exist independently for two different entity types', async () => {
    const name = uniqueName('Argentina');

    await service.syncNames('COUNTRY', [name]);
    await service.syncNames('TEAM', [name]);

    const rows = await prisma.displayNameOverride.findMany({ where: { rawName: name } });
    expect(rows.map((row) => row.entityType).sort()).toEqual(['COUNTRY', 'TEAM']);
  });

  it('setDisplayName updates the override and records an audit entry', async () => {
    const name = uniqueName('UEFA Champions League Qualification');
    const created = await prisma.displayNameOverride.create({
      data: { entityType: 'COMPETITION', rawName: name },
    });

    const updated = await service.setDisplayName(created.id, 'UEFA Champions League (Q)', TEST_ACTOR);
    expect(updated.displayName).toBe('UEFA Champions League (Q)');

    const entries = await prisma.auditLogEntry.findMany({ where: { actorUsername: TEST_ACTOR.username } });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe('DISPLAY_NAME_OVERRIDE_SET');
    expect(entries[0]?.metadata).toMatchObject({
      entityType: 'COMPETITION',
      rawName: name,
      displayName: 'UEFA Champions League (Q)',
    });
  });

  it('setDisplayName with null clears a previously-set override', async () => {
    const name = uniqueName('Clear FC');
    const created = await prisma.displayNameOverride.create({
      data: { entityType: 'TEAM', rawName: name, displayName: 'Something' },
    });

    const updated = await service.setDisplayName(created.id, null, TEST_ACTOR);
    expect(updated.displayName).toBeNull();
  });

  it('setDisplayName throws NotFoundException for a nonexistent id', async () => {
    await expect(service.setDisplayName('does-not-exist', 'X', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('listAssigned only returns rows with a displayName set', async () => {
    const withOverride = uniqueName('Assigned Competition');
    const withoutOverride = uniqueName('Unassigned Competition');
    await prisma.displayNameOverride.create({
      data: { entityType: 'COMPETITION', rawName: withOverride, displayName: 'Nicer Name' },
    });
    await prisma.displayNameOverride.create({ data: { entityType: 'COMPETITION', rawName: withoutOverride } });

    const assigned = await service.listAssigned();
    const names = assigned.map((row) => row.rawName);
    expect(names).toContain(withOverride);
    expect(names).not.toContain(withoutOverride);
  });

  it('list filters by entity type when given one', async () => {
    const teamName = uniqueName('Filter Team');
    const countryName = uniqueName('Filter Country');
    await prisma.displayNameOverride.create({ data: { entityType: 'TEAM', rawName: teamName } });
    await prisma.displayNameOverride.create({ data: { entityType: 'COUNTRY', rawName: countryName } });

    const teams = await service.list('TEAM');
    expect(teams.map((row) => row.rawName)).toContain(teamName);
    expect(teams.map((row) => row.rawName)).not.toContain(countryName);
  });
});

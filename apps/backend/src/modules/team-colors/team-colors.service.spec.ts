import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { TeamColorsService } from './team-colors.service';

describe('TeamColorsService', () => {
  let moduleRef: TestingModule;
  let service: TeamColorsService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandId: string;
  let TEST_ACTOR: AuditActor;
  const testNames: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Test Brand Team Colors ${unique}`, slug: `test-brand-team-colors-${unique}` },
    });
    brandId = brand.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_cms_team_colors', brandId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [TeamColorsService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(TeamColorsService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
    if (testNames.length > 0) {
      await prisma.teamColor.deleteMany({ where: { name: { in: testNames } } });
      testNames.length = 0;
    }
    await moduleRef.close();
  });

  function uniqueName(prefix: string) {
    const name = `${prefix} ${randomUUID()}`;
    testNames.push(name);
    return name;
  }

  it('seeds known real team colors on startup', async () => {
    const arsenal = await prisma.teamColor.findUnique({ where: { name: 'Arsenal' } });
    expect(arsenal?.colorHex).toBe('#EF0107');
  });

  it('syncNames creates only genuinely new names, with colorHex left null', async () => {
    const name = uniqueName('Sync FC');

    await service.syncNames([name]);
    const created = await prisma.teamColor.findUnique({ where: { name } });
    expect(created?.colorHex).toBeNull();
  });

  it('syncNames does not touch an existing row (or its colorHex)', async () => {
    const name = uniqueName('Existing FC');
    await prisma.teamColor.create({ data: { name, colorHex: '#123456' } });

    await service.syncNames([name]);
    const row = await prisma.teamColor.findUnique({ where: { name } });
    expect(row?.colorHex).toBe('#123456');
  });

  it('syncNames de-duplicates names within the same call', async () => {
    const name = uniqueName('Dup FC');

    await service.syncNames([name, name, ` ${name} `]);
    const rows = await prisma.teamColor.findMany({ where: { name } });
    expect(rows).toHaveLength(1);
  });

  it('setColor updates the color and records an audit entry', async () => {
    const name = uniqueName('Color FC');
    const created = await prisma.teamColor.create({ data: { name } });

    const updated = await service.setColor(created.id, '#ABCDEF', TEST_ACTOR);
    expect(updated.colorHex).toBe('#ABCDEF');

    const entries = await prisma.auditLogEntry.findMany({ where: { actorUsername: TEST_ACTOR.username } });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe('TEAM_COLOR_SET');
    expect(entries[0]?.metadata).toMatchObject({ name, colorHex: '#ABCDEF' });
  });

  it('setColor with null clears a previously-set color', async () => {
    const name = uniqueName('Clear FC');
    const created = await prisma.teamColor.create({ data: { name, colorHex: '#111111' } });

    const updated = await service.setColor(created.id, null, TEST_ACTOR);
    expect(updated.colorHex).toBeNull();
  });

  it('setColor throws NotFoundException for a nonexistent id', async () => {
    await expect(service.setColor('does-not-exist', '#ABCDEF', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('listAssigned only returns rows with a colorHex set', async () => {
    const withColor = uniqueName('Assigned FC');
    const withoutColor = uniqueName('Unassigned FC');
    await prisma.teamColor.create({ data: { name: withColor, colorHex: '#654321' } });
    await prisma.teamColor.create({ data: { name: withoutColor } });

    const assigned = await service.listAssigned();
    const names = assigned.map((row) => row.name);
    expect(names).toContain(withColor);
    expect(names).not.toContain(withoutColor);
  });
});

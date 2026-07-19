import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../admin/audit-log.service';
import { DisplayNamesService } from './display-names.service';
import { PublicDisplayNamesController } from './public-display-names.controller';

describe('PublicDisplayNamesController', () => {
  let moduleRef: TestingModule;
  let controller: PublicDisplayNamesController;
  let prisma: PrismaService;
  const testNames: string[] = [];

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PublicDisplayNamesController],
      providers: [DisplayNamesService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(PublicDisplayNamesController);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
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

  it('returns only entityType + rawName + displayName for overrides that are actually set, excluding unassigned rows', async () => {
    const assigned = uniqueName('UEFA Champions League Qualification');
    const unassigned = uniqueName('Unassigned Competition');
    await prisma.displayNameOverride.create({
      data: { entityType: 'COMPETITION', rawName: assigned, displayName: 'UEFA Champions League (Q)' },
    });
    await prisma.displayNameOverride.create({ data: { entityType: 'COMPETITION', rawName: unassigned } });

    const result = await controller.listAssigned();

    expect(result).toContainEqual({
      entityType: 'COMPETITION',
      rawName: assigned,
      displayName: 'UEFA Champions League (Q)',
    });
    expect(result.find((row) => row.rawName === unassigned)).toBeUndefined();
    for (const row of result) {
      expect(Object.keys(row).sort()).toEqual(['displayName', 'entityType', 'rawName']);
    }
  });
});

import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../admin/audit-log.service';
import { PublicTeamColorsController } from './public-team-colors.controller';
import { TeamColorsService } from './team-colors.service';

describe('PublicTeamColorsController', () => {
  let moduleRef: TestingModule;
  let controller: PublicTeamColorsController;
  let prisma: PrismaService;
  const testNames: string[] = [];

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PublicTeamColorsController],
      providers: [TeamColorsService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(PublicTeamColorsController);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
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

  it('returns only name + colorHex for teams with an assigned color, excluding unassigned rows', async () => {
    const assigned = uniqueName('Public Assigned FC');
    const unassigned = uniqueName('Public Unassigned FC');
    await prisma.teamColor.create({ data: { name: assigned, colorHex: '#ABCDEF' } });
    await prisma.teamColor.create({ data: { name: unassigned } });

    const result = await controller.listAssigned();

    expect(result).toContainEqual({ name: assigned, colorHex: '#ABCDEF' });
    expect(result.find((row) => row.name === unassigned)).toBeUndefined();
    for (const row of result) {
      expect(Object.keys(row).sort()).toEqual(['colorHex', 'name']);
    }
  });
});

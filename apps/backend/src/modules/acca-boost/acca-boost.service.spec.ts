import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { AccaBoostService } from './acca-boost.service';

describe('AccaBoostService', () => {
  let moduleRef: TestingModule;
  let service: AccaBoostService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-acca-boost-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-acca-boost-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_acca_boost', brandId: brandAId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [AccaBoostService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(AccaBoostService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
    await prisma.accaBoostConfig.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('returns boost-off defaults when no config row exists yet', async () => {
    const config = await service.getConfig(brandAId);

    expect(config).toEqual({
      boostPercentPerLeg: 5,
      minSelections: 3,
      minOddsPerLeg: 1.2,
      enabled: false,
    });
  });

  it('sets a config and reads it back', async () => {
    await service.setConfig(
      brandAId,
      { boostPercentPerLeg: 7, minSelections: 4, minOddsPerLeg: 1.3, enabled: true },
      TEST_ACTOR,
    );

    expect(await service.getConfig(brandAId)).toEqual({
      boostPercentPerLeg: 7,
      minSelections: 4,
      minOddsPerLeg: 1.3,
      enabled: true,
    });
  });

  it('is idempotent - setting a config again updates it in place rather than duplicating', async () => {
    await service.setConfig(
      brandAId,
      { boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: true },
      TEST_ACTOR,
    );
    await service.setConfig(
      brandAId,
      { boostPercentPerLeg: 10, minSelections: 3, minOddsPerLeg: 1.2, enabled: true },
      TEST_ACTOR,
    );

    expect(await prisma.accaBoostConfig.count({ where: { brandId: brandAId } })).toBe(1);
    expect((await service.getConfig(brandAId)).boostPercentPerLeg).toBe(10);
  });

  it('records an audit entry for each set', async () => {
    await service.setConfig(
      brandAId,
      { boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: true },
      TEST_ACTOR,
    );

    const entries = await prisma.auditLogEntry.findMany({ where: { actorUsername: TEST_ACTOR.username } });
    expect(entries.map((entry) => entry.action)).toEqual(['ACCA_BOOST_CONFIG_SET']);
  });

  it('is isolated per brand', async () => {
    await service.setConfig(
      brandAId,
      { boostPercentPerLeg: 9, minSelections: 3, minOddsPerLeg: 1.2, enabled: true },
      TEST_ACTOR,
    );

    expect(await service.getConfig(brandBId)).toEqual({
      boostPercentPerLeg: 5,
      minSelections: 3,
      minOddsPerLeg: 1.2,
      enabled: false,
    });
  });
});

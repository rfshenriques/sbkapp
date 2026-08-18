import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { InsuranceBetService } from './insurance-bet.service';

describe('InsuranceBetService', () => {
  let moduleRef: TestingModule;
  let service: InsuranceBetService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-insurance-bet-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-insurance-bet-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_insurance_bet', brandId: brandAId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [InsuranceBetService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(InsuranceBetService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
    await prisma.insuranceBetConfig.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('returns insurance-off defaults with no odds floor when no config row exists yet', async () => {
    const config = await service.getConfig(brandAId);

    expect(config).toEqual({ costPercent: 10, enabled: false, minOdds: 1 });
  });

  it('sets a config and reads it back', async () => {
    await service.setConfig(brandAId, { costPercent: 15, enabled: true, minOdds: 1 }, TEST_ACTOR);

    expect(await service.getConfig(brandAId)).toEqual({ costPercent: 15, enabled: true, minOdds: 1 });
  });

  it('sets and reads back a configured odds floor', async () => {
    await service.setConfig(brandAId, { costPercent: 15, enabled: true, minOdds: 1.5 }, TEST_ACTOR);

    expect(await service.getConfig(brandAId)).toEqual({ costPercent: 15, enabled: true, minOdds: 1.5 });
  });

  it('is idempotent - setting a config again updates it in place rather than duplicating', async () => {
    await service.setConfig(brandAId, { costPercent: 10, enabled: true, minOdds: 1 }, TEST_ACTOR);
    await service.setConfig(brandAId, { costPercent: 20, enabled: true, minOdds: 2 }, TEST_ACTOR);

    expect(await prisma.insuranceBetConfig.count({ where: { brandId: brandAId } })).toBe(1);
    const config = await service.getConfig(brandAId);
    expect(config.costPercent).toBe(20);
    expect(config.minOdds).toBe(2);
  });

  it('records an audit entry for each set', async () => {
    await service.setConfig(brandAId, { costPercent: 10, enabled: true, minOdds: 1 }, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({ where: { actorUsername: TEST_ACTOR.username } });
    expect(entries.map((entry) => entry.action)).toEqual(['INSURANCE_BET_CONFIG_SET']);
  });

  it('is isolated per brand', async () => {
    await service.setConfig(brandAId, { costPercent: 25, enabled: true, minOdds: 3 }, TEST_ACTOR);

    expect(await service.getConfig(brandBId)).toEqual({ costPercent: 10, enabled: false, minOdds: 1 });
  });
});

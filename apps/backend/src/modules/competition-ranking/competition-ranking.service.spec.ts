import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { CompetitionRankingService } from './competition-ranking.service';

describe('CompetitionRankingService', () => {
  let moduleRef: TestingModule;
  let service: CompetitionRankingService;
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
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_cms_rankings', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_cms_rankings_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [CompetitionRankingService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(CompetitionRankingService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.competitionRanking.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('sets a ranking and lists it back, lowest rank first', async () => {
    await service.setRanking(brandAId, 'La Liga - Spain', 2, TEST_ACTOR);
    await service.setRanking(brandAId, 'EPL', 0, TEST_ACTOR);
    await service.setRanking(brandAId, 'Bundesliga - Germany', 1, TEST_ACTOR);

    const rankings = await service.listRankings(brandAId);
    expect(rankings.map((ranking) => ranking.competition)).toEqual([
      'EPL',
      'Bundesliga - Germany',
      'La Liga - Spain',
    ]);
  });

  it('is idempotent - setting a rank for an already-ranked competition updates it instead of duplicating', async () => {
    await service.setRanking(brandAId, 'EPL', 5, TEST_ACTOR);
    await service.setRanking(brandAId, 'EPL', 0, TEST_ACTOR);

    const rankings = await prisma.competitionRanking.findMany({
      where: { brandId: brandAId, competition: 'EPL' },
    });
    expect(rankings).toHaveLength(1);
    expect(rankings[0]?.rank).toBe(0);
  });

  it('removing a ranking deletes it', async () => {
    const ranking = await service.setRanking(brandAId, 'EPL', 0, TEST_ACTOR);
    await service.removeRanking(brandAId, ranking.id, TEST_ACTOR);

    expect(await service.listRankings(brandAId)).toEqual([]);
  });

  it('removing a nonexistent ranking throws NotFoundException', async () => {
    await expect(
      service.removeRanking(brandAId, 'does-not-exist', TEST_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records audit entries for set and remove', async () => {
    const ranking = await service.setRanking(brandAId, 'EPL', 0, TEST_ACTOR);
    await service.removeRanking(brandAId, ranking.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'COMPETITION_RANKING_SET',
      'COMPETITION_RANKING_REMOVED',
    ]);
    expect(entries[0]?.brandId).toBe(brandAId);
    expect(entries[0]?.metadata).toMatchObject({ competition: 'EPL', rank: 0 });
  });

  it('is isolated per brand: the same competition ranked in one brand does not affect another', async () => {
    await service.setRanking(brandAId, 'EPL', 0, TEST_ACTOR);

    expect(await service.listRankings(brandAId)).toHaveLength(1);
    expect(await service.listRankings(brandBId)).toHaveLength(0);
  });

  it("a brand can never remove another brand's ranking, even by guessing its id", async () => {
    const ranking = await service.setRanking(brandAId, 'EPL', 0, TEST_ACTOR);

    await expect(
      service.removeRanking(brandBId, ranking.id, OTHER_BRAND_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.listRankings(brandAId)).toHaveLength(1);
  });
});

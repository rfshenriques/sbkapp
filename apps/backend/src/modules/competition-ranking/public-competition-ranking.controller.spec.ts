import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../admin/audit-log.service';
import { CompetitionRankingService } from './competition-ranking.service';
import { PublicCompetitionRankingController } from './public-competition-ranking.controller';

describe('PublicCompetitionRankingController', () => {
  let moduleRef: TestingModule;
  let controller: PublicCompetitionRankingController;
  let prisma: PrismaService;
  let brandId: string;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PublicCompetitionRankingController],
      providers: [CompetitionRankingService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(PublicCompetitionRankingController);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    const brand = await prisma.brand.create({
      data: { name: `Public Ranking Brand ${unique}`, slug: `public-ranking-brand-${unique}` },
    });
    brandId = brand.id;
  });

  afterEach(async () => {
    await prisma.competitionRanking.deleteMany({ where: { brandId } });
    await prisma.brand.delete({ where: { id: brandId } });
    await moduleRef.close();
  });

  it('returns only competition + rank, ordered lowest rank first, no internal ids', async () => {
    await prisma.competitionRanking.createMany({
      data: [
        { brandId, competition: 'La Liga - Spain', rank: 2 },
        { brandId, competition: 'EPL', rank: 0 },
      ],
    });

    const result = await controller.listForBrand(brandId);

    expect(result).toEqual([
      { competition: 'EPL', rank: 0 },
      { competition: 'La Liga - Spain', rank: 2 },
    ]);
  });

  it('returns an empty list for a brand with no configured rankings', async () => {
    expect(await controller.listForBrand(brandId)).toEqual([]);
  });
});

import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../admin/audit-log.service';
import { CompetitionQuicklinkService } from './competition-quicklink.service';
import { PublicCompetitionQuicklinkController } from './public-competition-quicklink.controller';

describe('PublicCompetitionQuicklinkController', () => {
  let moduleRef: TestingModule;
  let controller: PublicCompetitionQuicklinkController;
  let prisma: PrismaService;
  let brandId: string;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PublicCompetitionQuicklinkController],
      providers: [CompetitionQuicklinkService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(PublicCompetitionQuicklinkController);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    const brand = await prisma.brand.create({
      data: { name: `Public Quicklink Brand ${unique}`, slug: `public-quicklink-brand-${unique}` },
    });
    brandId = brand.id;
  });

  afterEach(async () => {
    await prisma.competitionQuicklink.deleteMany({ where: { brandId } });
    await prisma.brand.delete({ where: { id: brandId } });
    await moduleRef.close();
  });

  it('returns only competition + order, ordered lowest order first, no internal ids', async () => {
    await prisma.competitionQuicklink.createMany({
      data: [
        { brandId, competition: 'La Liga - Spain', order: 2 },
        { brandId, competition: 'EPL', order: 0 },
      ],
    });

    const result = await controller.listForBrand(brandId);

    expect(result).toEqual([
      { competition: 'EPL', order: 0 },
      { competition: 'La Liga - Spain', order: 2 },
    ]);
  });

  it('returns an empty list for a brand with no configured quicklinks', async () => {
    expect(await controller.listForBrand(brandId)).toEqual([]);
  });
});

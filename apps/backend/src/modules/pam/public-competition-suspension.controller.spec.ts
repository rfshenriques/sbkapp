import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../admin/audit-log.service';
import { CompetitionSuspensionService } from './competition-suspension.service';
import { PublicCompetitionSuspensionController } from './public-competition-suspension.controller';

describe('PublicCompetitionSuspensionController', () => {
  let moduleRef: TestingModule;
  let controller: PublicCompetitionSuspensionController;
  let prisma: PrismaService;
  let brandId: string;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PublicCompetitionSuspensionController],
      providers: [CompetitionSuspensionService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(PublicCompetitionSuspensionController);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    const brand = await prisma.brand.create({
      data: {
        name: `Public Competition Suspension Brand ${unique}`,
        slug: `public-competition-suspension-brand-${unique}`,
      },
    });
    brandId = brand.id;
  });

  afterEach(async () => {
    await prisma.competitionSuspension.deleteMany({ where: { brandId } });
    await prisma.brand.delete({ where: { id: brandId } });
    await moduleRef.close();
  });

  it('returns only the competition name, no suspension id or reason', async () => {
    await prisma.competitionSuspension.create({
      data: { brandId, competition: 'EPL', reason: 'internal trading note' },
    });

    const result = await controller.listForBrand(brandId);

    expect(result).toEqual(['EPL']);
  });

  it('returns an empty list for a brand with no suspended competitions', async () => {
    expect(await controller.listForBrand(brandId)).toEqual([]);
  });
});

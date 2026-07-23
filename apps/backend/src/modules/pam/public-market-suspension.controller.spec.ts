import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../admin/audit-log.service';
import { MarketSuspensionService } from './market-suspension.service';
import { PublicMarketSuspensionController } from './public-market-suspension.controller';

describe('PublicMarketSuspensionController', () => {
  let moduleRef: TestingModule;
  let controller: PublicMarketSuspensionController;
  let prisma: PrismaService;
  let brandId: string;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PublicMarketSuspensionController],
      providers: [MarketSuspensionService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(PublicMarketSuspensionController);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    const brand = await prisma.brand.create({
      data: { name: `Public Suspension Brand ${unique}`, slug: `public-suspension-brand-${unique}` },
    });
    brandId = brand.id;
  });

  afterEach(async () => {
    await prisma.marketSuspension.deleteMany({ where: { brandId } });
    await prisma.brand.delete({ where: { id: brandId } });
    await moduleRef.close();
  });

  it('returns only matchId + marketId + selectionId, no suspension id or reason', async () => {
    await prisma.marketSuspension.create({
      data: { brandId, matchId: 'match-1', marketId: 'match-result', reason: 'internal trading note' },
    });

    const result = await controller.listForBrand(brandId);

    expect(result).toEqual([{ matchId: 'match-1', marketId: 'match-result', selectionId: '' }]);
  });

  it('a whole-match suspension is exposed with an empty marketId, same as it is stored', async () => {
    await prisma.marketSuspension.create({ data: { brandId, matchId: 'match-2', marketId: '' } });

    const result = await controller.listForBrand(brandId);

    expect(result).toEqual([{ matchId: 'match-2', marketId: '', selectionId: '' }]);
  });

  it('a selection-level suspension is exposed with its selectionId set', async () => {
    await prisma.marketSuspension.create({
      data: { brandId, matchId: 'match-3', marketId: 'match-result', selectionId: 'home' },
    });

    const result = await controller.listForBrand(brandId);

    expect(result).toEqual([{ matchId: 'match-3', marketId: 'match-result', selectionId: 'home' }]);
  });

  it('returns an empty list for a brand with no suspensions', async () => {
    expect(await controller.listForBrand(brandId)).toEqual([]);
  });
});

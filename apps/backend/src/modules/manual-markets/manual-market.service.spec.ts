import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Match } from '@sportsbook/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { ManualMarketService } from './manual-market.service';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    sport: 'Football',
    country: 'England',
    competition: 'EPL',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: '2026-07-18T15:00:00Z',
    isLive: false,
    markets: [
      { id: 'match-result', name: 'Match Result', selections: [{ id: 'home', name: 'Home', odds: 2.0 }] },
    ],
    ...overrides,
  };
}

describe('ManualMarketService', () => {
  let moduleRef: TestingModule;
  let service: ManualMarketService;
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
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-manual-markets-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-manual-markets-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_manual_markets', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_manual_markets_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [ManualMarketService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(ManualMarketService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.manualMarket.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('creates a market with its selections and lists it back', async () => {
    await service.createMarket(
      brandAId,
      'match-1',
      'To Win Both Halves',
      [
        { name: 'Yes', odds: 3.5 },
        { name: 'No', odds: 1.25 },
      ],
      TEST_ACTOR,
    );

    const listed = await service.listMarkets(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe('To Win Both Halves');
    expect(listed[0]?.selections.map((s) => s.name)).toEqual(['Yes', 'No']);
  });

  it('updating a market replaces its name and its entire selection list', async () => {
    const market = await service.createMarket(
      brandAId,
      'match-1',
      'To Win Both Halves',
      [
        { name: 'Yes', odds: 3.5 },
        { name: 'No', odds: 1.25 },
      ],
      TEST_ACTOR,
    );

    const updated = await service.updateMarket(
      brandAId,
      market.id,
      'To Win Both Halves (corrected)',
      [{ name: 'Definitely', odds: 4.0 }],
      TEST_ACTOR,
    );

    expect(updated.name).toBe('To Win Both Halves (corrected)');
    expect(updated.selections.map((s) => s.name)).toEqual(['Definitely']);
    expect(
      await prisma.manualMarketSelection.findMany({ where: { manualMarketId: market.id } }),
    ).toHaveLength(1);
  });

  it('updating a nonexistent market throws NotFoundException', async () => {
    await expect(
      service.updateMarket(brandAId, 'does-not-exist', 'Renamed', [{ name: 'Yes', odds: 2 }], TEST_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("a brand can never update another brand's manual market, even by guessing its id", async () => {
    const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);

    await expect(
      service.updateMarket(brandBId, market.id, 'Hijacked', [{ name: 'Yes', odds: 2 }], OTHER_BRAND_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.listMarkets(brandAId))[0]?.name).toBe('Novelty');
  });

  it('removing a market cascades to its selections', async () => {
    const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
    await service.removeMarket(brandAId, market.id, TEST_ACTOR);

    expect(await service.listMarkets(brandAId)).toEqual([]);
    expect(await prisma.manualMarketSelection.findMany({ where: { manualMarketId: market.id } })).toEqual([]);
  });

  it('removing a nonexistent market throws NotFoundException', async () => {
    await expect(service.removeMarket(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("a brand can never remove another brand's manual market, even by guessing its id", async () => {
    const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);

    await expect(service.removeMarket(brandBId, market.id, OTHER_BRAND_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await service.listMarkets(brandAId)).toHaveLength(1);
  });

  it('records audit entries for create, update, and remove', async () => {
    const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
    await service.updateMarket(brandAId, market.id, 'Novelty (renamed)', [{ name: 'Yes', odds: 2.5 }], TEST_ACTOR);
    await service.removeMarket(brandAId, market.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'MANUAL_MARKET_CREATED',
      'MANUAL_MARKET_UPDATED',
      'MANUAL_MARKET_REMOVED',
    ]);
    expect(entries[0]?.targetType).toBe('ManualMarket');
  });

  it('is isolated per brand', async () => {
    await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);

    expect(await service.listMarkets(brandAId)).toHaveLength(1);
    expect(await service.listMarkets(brandBId)).toEqual([]);
  });

  describe('mergeIntoMatches', () => {
    it('passes matches through unchanged when there are no manual markets', async () => {
      const match = buildMatch();
      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result).toEqual(match);
    });

    it('appends a manual market onto its match, leaving feed markets untouched', async () => {
      await service.createMarket(
        brandAId,
        'match-1',
        'To Win Both Halves',
        [{ name: 'Yes', odds: 3.5 }],
        TEST_ACTOR,
      );
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result?.markets).toHaveLength(2);
      expect(result?.markets[0]).toEqual(match.markets[0]);
      expect(result?.markets[1]?.name).toBe('To Win Both Halves');
      expect(result?.markets[1]?.selections).toEqual([{ id: expect.any(String), name: 'Yes', odds: 3.5 }]);
    });

    it('does not append a manual market onto a different match', async () => {
      await service.createMarket(brandAId, 'some-other-match', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result?.markets).toHaveLength(1);
    });

    it('is isolated per brand', async () => {
      await service.createMarket(brandBId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], OTHER_BRAND_ACTOR);
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result).toEqual(match);
    });
  });
});

import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Match } from '@sportsbook/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { BoostService } from './boost.service';
import { OddsLadderService } from './odds-ladder.service';

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

describe('BoostService', () => {
  let moduleRef: TestingModule;
  let service: BoostService;
  let ladderService: OddsLadderService;
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
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-boosts-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-boosts-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_boosts', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_boosts_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [BoostService, OddsLadderService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(BoostService);
    ladderService = moduleRef.get(OddsLadderService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.boost.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await prisma.oddsLadderRung.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('sets a boost and lists it back', async () => {
    await service.setBoost(brandAId, 'match-1', 'match-result', 'home', 6, 'promo', TEST_ACTOR);

    const listed = await service.listBoosts(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      matchId: 'match-1',
      marketId: 'match-result',
      selectionId: 'home',
      ticks: 6,
      reason: 'promo',
    });
  });

  it('is idempotent - re-setting an already-boosted selection updates its ticks instead of duplicating (this is how a boost is edited)', async () => {
    await service.setBoost(brandAId, 'match-1', 'match-result', 'home', 6, 'first', TEST_ACTOR);
    await service.setBoost(brandAId, 'match-1', 'match-result', 'home', 3, 'second', TEST_ACTOR);

    const listed = await service.listBoosts(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.ticks).toBe(3);
    expect(listed[0]?.reason).toBe('second');
  });

  it('clearing removes the boost', async () => {
    const boost = await service.setBoost(brandAId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
    await service.clearBoost(brandAId, boost.id, TEST_ACTOR);

    expect(await service.listBoosts(brandAId)).toEqual([]);
  });

  it('clearing a nonexistent boost throws NotFoundException', async () => {
    await expect(service.clearBoost(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("a brand can never clear another brand's boost, even by guessing its id", async () => {
    const boost = await service.setBoost(brandAId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);

    await expect(service.clearBoost(brandBId, boost.id, OTHER_BRAND_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await service.listBoosts(brandAId)).toHaveLength(1);
  });

  it('records audit entries for set and clear', async () => {
    const boost = await service.setBoost(brandAId, 'match-1', 'match-result', 'home', 6, 'promo', TEST_ACTOR);
    await service.clearBoost(brandAId, boost.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual(['BOOST_SET', 'BOOST_CLEARED']);
    expect(entries[0]?.targetType).toBe('Selection');
  });

  it('is isolated per brand', async () => {
    await service.setBoost(brandAId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);

    expect(await service.listBoosts(brandAId)).toHaveLength(1);
    expect(await service.listBoosts(brandBId)).toEqual([]);
  });

  describe('applyBoosts', () => {
    it('passes matches through unchanged when there are no boosts', async () => {
      const match = buildMatch();
      const [result] = await service.applyBoosts(brandAId, [match]);

      expect(result).toEqual(match);
    });

    it('climbs the ladder from the current price and records originalOdds', async () => {
      await ladderService.regenerateStandard(brandAId, TEST_ACTOR);
      // Home is priced at 2.00 - the standard ladder's 2.00-3.00 band steps by 0.02, so +6 ticks -> 2.12.
      await service.setBoost(brandAId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.applyBoosts(brandAId, [match]);
      const home = result?.markets[0]?.selections.find((s) => s.id === 'home');

      expect(home?.originalOdds).toBe(2.0);
      expect(home?.odds).toBe(2.12);
    });

    it('passes a selection through unboosted when no ladder is configured for the brand', async () => {
      await service.setBoost(brandAId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.applyBoosts(brandAId, [match]);
      const home = result?.markets[0]?.selections.find((s) => s.id === 'home');

      expect(home?.odds).toBe(2.0);
      expect(home?.originalOdds).toBeUndefined();
    });

    it('does not boost a different match sharing the same market/selection ids', async () => {
      await ladderService.regenerateStandard(brandAId, TEST_ACTOR);
      await service.setBoost(brandAId, 'some-other-match', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.applyBoosts(brandAId, [match]);

      expect(result?.markets[0]?.selections[0]?.odds).toBe(2.0);
      expect(result?.markets[0]?.selections[0]?.originalOdds).toBeUndefined();
    });

    it('is isolated per brand', async () => {
      await ladderService.regenerateStandard(brandBId, OTHER_BRAND_ACTOR);
      await service.setBoost(brandBId, 'match-1', 'match-result', 'home', 6, undefined, OTHER_BRAND_ACTOR);
      const match = buildMatch();

      const [result] = await service.applyBoosts(brandAId, [match]);

      expect(result).toEqual(match);
    });
  });
});

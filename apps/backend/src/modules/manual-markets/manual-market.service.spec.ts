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

    it('marks a manual market with isSpecial so the player app can group it under Specials', async () => {
      await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result?.markets[1]?.isSpecial).toBe(true);
    });

    it('exposes a configured max stake cap on the merged market so players can see it', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await service.setLimits(brandAId, market.id, { maxStakeCents: 5_000 }, TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result?.markets[1]?.maxStakeCents).toBe(5_000);
    });

    it('omits maxStakeCents on a merged market with no cap configured', async () => {
      await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result?.markets[1]?.maxStakeCents).toBeUndefined();
    });

    it('exposes singlesOnly on the merged market so the player app can warn against combining it', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await service.setLimits(brandAId, market.id, { singlesOnly: true }, TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result?.markets[1]?.singlesOnly).toBe(true);
    });

    it('omits singlesOnly on a merged market that is not restricted', async () => {
      await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result?.markets[1]?.singlesOnly).toBeUndefined();
    });

    it('hides a LOGGED_IN-only market from an anonymous viewer', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await service.setLimits(brandAId, market.id, { audienceMode: 'LOGGED_IN' }, TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result?.markets).toHaveLength(1);
    });

    it('shows a LOGGED_IN-only market to a logged-in viewer', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await service.setLimits(brandAId, market.id, { audienceMode: 'LOGGED_IN' }, TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match], { isLoggedIn: true, segmentIds: [] });

      expect(result?.markets).toHaveLength(2);
    });

    it('shows a SEGMENTS-targeted market only to a viewer in one of its segments', async () => {
      const segmentA = await prisma.playerSegment.create({ data: { brandId: brandAId, name: 'Segment A' } });
      const segmentB = await prisma.playerSegment.create({ data: { brandId: brandAId, name: 'Segment B' } });
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await service.setLimits(
        brandAId,
        market.id,
        { audienceMode: 'SEGMENTS', segmentIds: [segmentA.id] },
        TEST_ACTOR,
      );
      const match = buildMatch();

      const [hidden] = await service.mergeIntoMatches(brandAId, [match], {
        isLoggedIn: true,
        segmentIds: [segmentB.id],
      });
      const [shown] = await service.mergeIntoMatches(brandAId, [match], {
        isLoggedIn: true,
        segmentIds: [segmentA.id],
      });

      expect(hidden?.markets).toHaveLength(1);
      expect(shown?.markets).toHaveLength(2);

      await prisma.playerSegment.deleteMany({ where: { id: { in: [segmentA.id, segmentB.id] } } });
    });

    it('skips a disabled market entirely', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await prisma.manualMarket.update({ where: { id: market.id }, data: { disabledAt: new Date() } });
      const match = buildMatch();

      const [result] = await service.mergeIntoMatches(brandAId, [match]);

      expect(result?.markets).toHaveLength(1);
    });

    it('suppresses a market once its match is in-play, since it has no live re-pricing feed', async () => {
      await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      const liveMatch = buildMatch({ isLive: true });

      const [result] = await service.mergeIntoMatches(brandAId, [liveMatch]);

      expect(result?.markets).toHaveLength(1);
    });

    it('keeps offering an in-play market when staysLiveDuringInplay is set', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await service.setLimits(brandAId, market.id, { staysLiveDuringInplay: true }, TEST_ACTOR);
      const liveMatch = buildMatch({ isLive: true });

      const [result] = await service.mergeIntoMatches(brandAId, [liveMatch]);

      expect(result?.markets).toHaveLength(2);
    });
  });

  describe('setLimits', () => {
    it('sets max stake and max liability, leaving other fields unchanged', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);

      const updated = await service.setLimits(
        brandAId,
        market.id,
        { maxStakeCents: 5_000, maxLiabilityCents: 20_000 },
        TEST_ACTOR,
      );

      expect(updated.maxStakeCents).toBe(5_000);
      expect(updated.maxLiabilityCents).toBe(20_000);
      expect(updated.name).toBe('Novelty');
    });

    it('clears a cap by setting it to null', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await service.setLimits(brandAId, market.id, { maxStakeCents: 5_000 }, TEST_ACTOR);

      const cleared = await service.setLimits(brandAId, market.id, { maxStakeCents: null }, TEST_ACTOR);

      expect(cleared.maxStakeCents).toBeNull();
    });

    it("a brand can never set limits on another brand's market, even by guessing its id", async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);

      await expect(
        service.setLimits(brandBId, market.id, { maxStakeCents: 1 }, OTHER_BRAND_ACTOR),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('records an audit entry', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await service.setLimits(brandAId, market.id, { maxStakeCents: 5_000 }, TEST_ACTOR);

      const entries = await prisma.auditLogEntry.findMany({
        where: { actorUsername: TEST_ACTOR.username, action: 'MANUAL_MARKET_LIMITS_SET' },
      });
      expect(entries).toHaveLength(1);
    });
  });

  describe('findForBet', () => {
    it('returns the market when it belongs to the given brand', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);

      expect(await service.findForBet(brandAId, market.id)).toMatchObject({ id: market.id });
    });

    it('returns null for a market belonging to another brand', async () => {
      const market = await service.createMarket(brandBId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], OTHER_BRAND_ACTOR);

      expect(await service.findForBet(brandAId, market.id)).toBeNull();
    });

    it('returns null for a disabled market', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await prisma.manualMarket.update({ where: { id: market.id }, data: { disabledAt: new Date() } });

      expect(await service.findForBet(brandAId, market.id)).toBeNull();
    });
  });

  describe('recordLiabilityAndMaybeDisable', () => {
    it('increments the running total without disabling when under the cap', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await service.setLimits(brandAId, market.id, { maxLiabilityCents: 10_000 }, TEST_ACTOR);

      await service.recordLiabilityAndMaybeDisable(market.id, 5_000, TEST_ACTOR);

      const updated = await service.findForBet(brandAId, market.id);
      expect(updated?.currentLiabilityCents).toBe(5_000);
      expect(updated).not.toBeNull();
    });

    it('auto-disables the market once the running total reaches the cap, with an audit entry', async () => {
      const market = await service.createMarket(brandAId, 'match-1', 'Novelty', [{ name: 'Yes', odds: 2 }], TEST_ACTOR);
      await service.setLimits(brandAId, market.id, { maxLiabilityCents: 10_000 }, TEST_ACTOR);

      await service.recordLiabilityAndMaybeDisable(market.id, 10_000, TEST_ACTOR);

      expect(await service.findForBet(brandAId, market.id)).toBeNull();
      const entries = await prisma.auditLogEntry.findMany({
        where: { actorUsername: TEST_ACTOR.username, action: 'MANUAL_MARKET_AUTO_DISABLED' },
      });
      expect(entries).toHaveLength(1);
    });
  });
});

import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Match } from '@sportsbook/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { OddsOverrideService } from './odds-override.service';

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
      {
        id: 'match-result',
        name: 'Match Result',
        selections: [
          { id: 'home', name: 'Home', odds: 2.0 },
          { id: 'draw', name: 'Draw', odds: 3.4 },
          { id: 'away', name: 'Away', odds: 3.2 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('OddsOverrideService', () => {
  let moduleRef: TestingModule;
  let service: OddsOverrideService;
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
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-odds-override-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-odds-override-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_odds_overrides', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_odds_overrides_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [OddsOverrideService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(OddsOverrideService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.oddsOverride.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('sets an override and lists it back', async () => {
    await service.setOverride(brandAId, 'match-1', 'match-result', 'home', 2.5, 'trading call', TEST_ACTOR);

    const listed = await service.listOverrides(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      matchId: 'match-1',
      marketId: 'match-result',
      selectionId: 'home',
      oddsValue: 2.5,
      reason: 'trading call',
    });
  });

  it('is idempotent - overriding an already-overridden selection updates the price instead of duplicating', async () => {
    await service.setOverride(brandAId, 'match-1', 'match-result', 'home', 2.5, 'first', TEST_ACTOR);
    await service.setOverride(brandAId, 'match-1', 'match-result', 'home', 1.8, 'second', TEST_ACTOR);

    const listed = await service.listOverrides(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.oddsValue).toBe(1.8);
    expect(listed[0]?.reason).toBe('second');
  });

  it('clearing removes the override', async () => {
    const override = await service.setOverride(
      brandAId,
      'match-1',
      'match-result',
      'home',
      2.5,
      undefined,
      TEST_ACTOR,
    );
    await service.clearOverride(brandAId, override.id, TEST_ACTOR);

    expect(await service.listOverrides(brandAId)).toEqual([]);
  });

  it('clearing a nonexistent override throws NotFoundException', async () => {
    await expect(service.clearOverride(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("a brand can never clear another brand's override, even by guessing its id", async () => {
    const override = await service.setOverride(
      brandAId,
      'match-1',
      'match-result',
      'home',
      2.5,
      undefined,
      TEST_ACTOR,
    );

    await expect(
      service.clearOverride(brandBId, override.id, OTHER_BRAND_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.listOverrides(brandAId)).toHaveLength(1);
  });

  it('records audit entries for set and clear', async () => {
    const override = await service.setOverride(
      brandAId,
      'match-1',
      'match-result',
      'home',
      2.5,
      'trading call',
      TEST_ACTOR,
    );
    await service.clearOverride(brandAId, override.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual(['ODDS_OVERRIDE_SET', 'ODDS_OVERRIDE_CLEARED']);
    expect(entries[0]?.targetType).toBe('Selection');
    expect(entries[0]?.metadata).toMatchObject({
      matchId: 'match-1',
      marketId: 'match-result',
      selectionId: 'home',
      oddsValue: 2.5,
      reason: 'trading call',
    });
  });

  it('is isolated per brand: the same selection overridden in one brand does not affect another', async () => {
    await service.setOverride(brandAId, 'match-1', 'match-result', 'home', 2.5, undefined, TEST_ACTOR);

    expect(await service.listOverrides(brandAId)).toHaveLength(1);
    expect(await service.listOverrides(brandBId)).toEqual([]);
  });

  describe('applyOverrides', () => {
    it('passes matches through unchanged when there are no overrides', async () => {
      const match = buildMatch();
      const [result] = await service.applyOverrides(brandAId, [match]);

      expect(result).toEqual(match);
    });

    it('substitutes only the overridden selection, leaving the rest of the market untouched', async () => {
      await service.setOverride(brandAId, 'match-1', 'match-result', 'home', 5.0, undefined, TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.applyOverrides(brandAId, [match]);
      const selections = result?.markets[0]?.selections ?? [];

      expect(selections.find((s) => s.id === 'home')?.odds).toBe(5.0);
      expect(selections.find((s) => s.id === 'draw')?.odds).toBe(3.4);
      expect(selections.find((s) => s.id === 'away')?.odds).toBe(3.2);
    });

    it('does not override a different match sharing the same market/selection ids', async () => {
      await service.setOverride(brandAId, 'some-other-match', 'match-result', 'home', 5.0, undefined, TEST_ACTOR);
      const match = buildMatch();

      const [result] = await service.applyOverrides(brandAId, [match]);

      expect(result?.markets[0]?.selections.find((s) => s.id === 'home')?.odds).toBe(2.0);
    });

    it('is isolated per brand', async () => {
      await service.setOverride(brandBId, 'match-1', 'match-result', 'home', 5.0, undefined, OTHER_BRAND_ACTOR);
      const match = buildMatch();

      const [result] = await service.applyOverrides(brandAId, [match]);

      expect(result).toEqual(match);
    });
  });
});

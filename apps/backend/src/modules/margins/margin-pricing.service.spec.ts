import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Match } from '@sportsbook/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { MarginPricingService } from './margin-pricing.service';

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

describe('MarginPricingService', () => {
  let moduleRef: TestingModule;
  let service: MarginPricingService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandId: string;

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Test Brand ${unique}`, slug: `test-brand-margin-pricing-${unique}` },
    });
    brandId = brand.id;
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [MarginPricingService, PrismaService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(MarginPricingService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.marginConfig.deleteMany({ where: { brandId } });
    await prisma.competitionTier.deleteMany({ where: { brandId } });
    await moduleRef.close();
  });

  it('passes matches through unchanged when the competition has no assigned tier', async () => {
    const match = buildMatch();
    const [result] = await service.applyMarginToMatches(brandId, [match]);

    expect(result).toEqual(match);
  });

  it('passes a market through unchanged when its tier has no margin configured', async () => {
    await prisma.competitionTier.create({ data: { brandId, competition: 'EPL', tier: 1 } });
    const match = buildMatch();

    const [result] = await service.applyMarginToMatches(brandId, [match]);

    expect(result?.markets[0]?.selections).toEqual(match.markets[0]?.selections);
  });

  it('applies the configured margin to every selection in a tiered competition + configured market', async () => {
    await prisma.competitionTier.create({ data: { brandId, competition: 'EPL', tier: 1 } });
    await prisma.marginConfig.create({
      data: { brandId, marketName: 'Match Result', tier: 1, marginPercent: 20 },
    });
    const match = buildMatch();

    const [result] = await service.applyMarginToMatches(brandId, [match]);
    const selections = result?.markets[0]?.selections ?? [];

    // 2.00 -> 50% + 20 = 70% -> 1.43
    expect(selections.find((s) => s.id === 'home')?.odds).toBeCloseTo(1.43, 2);
    // Every selection should be adjusted, not just the first.
    expect(selections.every((s, i) => s.odds !== match.markets[0]?.selections[i]?.odds)).toBe(true);
  });

  it('only adjusts markets matching the configured market name, leaving other markets on the same match untouched', async () => {
    await prisma.competitionTier.create({ data: { brandId, competition: 'EPL', tier: 1 } });
    await prisma.marginConfig.create({
      data: { brandId, marketName: 'Match Result', tier: 1, marginPercent: 20 },
    });
    const match = buildMatch({
      markets: [
        ...buildMatch().markets,
        { id: 'btts', name: 'Both Teams to Score', selections: [{ id: 'yes', name: 'Yes', odds: 1.9 }] },
      ],
    });

    const [result] = await service.applyMarginToMatches(brandId, [match]);

    expect(result?.markets[1]?.selections[0]?.odds).toBe(1.9);
  });

  it('is isolated per brand', async () => {
    const otherBrand = await prisma.brand.create({
      data: { name: 'Other margin brand', slug: `other-margin-brand-${randomUUID()}` },
    });
    await prisma.competitionTier.create({ data: { brandId: otherBrand.id, competition: 'EPL', tier: 1 } });
    await prisma.marginConfig.create({
      data: { brandId: otherBrand.id, marketName: 'Match Result', tier: 1, marginPercent: 20 },
    });
    const match = buildMatch();

    const [result] = await service.applyMarginToMatches(brandId, [match]);

    expect(result).toEqual(match);
    await prisma.brand.delete({ where: { id: otherBrand.id } });
  });
});

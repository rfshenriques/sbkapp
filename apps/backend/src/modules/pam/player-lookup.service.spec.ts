import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../admin/audit-log.service';
import { FreebetService } from '../freebets/freebet.service';
import { PlayerSegmentService } from '../player-segments/player-segment.service';
import { PlayerLookupService } from './player-lookup.service';

function buildSelectionData(overrides: Partial<{ sport: string; competition: string }> = {}) {
  return {
    matchId: 'match-1',
    marketId: 'match-result',
    selectionId: 'home',
    matchLabel: 'Arsenal vs Chelsea',
    marketName: 'Match Result',
    selectionName: 'Home',
    odds: 2,
    sport: 'Football',
    competition: 'Premier League',
    ...overrides,
  };
}

describe('PlayerLookupService', () => {
  let moduleRef: TestingModule;
  let service: PlayerLookupService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandId: string;
  let userId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Test Brand ${unique}`, slug: `test-brand-${unique}` },
    });
    brandId = brand.id;
  });

  afterAll(async () => {
    await setupPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await setupPrisma.brand.delete({ where: { id: brandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [PlayerLookupService, PrismaService, FreebetService, PlayerSegmentService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(PlayerLookupService);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `test-${unique}@example.com`,
        username: `user_${unique.slice(0, 8)}`,
        phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'irrelevant',
        brandId,
      },
    });
    userId = user.id;
    createdUserIds.push(user.id);
  });

  afterEach(async () => {
    await prisma.bet.deleteMany({ where: { userId } });
    await moduleRef.close();
  });

  it('returns null for a user that does not belong to this brand', async () => {
    const otherBrand = await setupPrisma.brand.create({
      data: { name: `Other Brand ${randomUUID()}`, slug: `other-brand-${randomUUID()}` },
    });
    expect(await service.getDetail(otherBrand.id, userId)).toBeNull();
    await setupPrisma.brand.delete({ where: { id: otherBrand.id } });
  });

  it('finds a player by a substring of their email, username, or phone', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    expect((await service.search(brandId, user.username.slice(0, 6))).map((row) => row.id)).toContain(userId);
    expect((await service.search(brandId, user.email.slice(0, 6))).map((row) => row.id)).toContain(userId);
    expect((await service.search(brandId, user.phone.slice(-6))).map((row) => row.id)).toContain(userId);
    expect((await service.search(brandId, randomUUID())).map((row) => row.id)).not.toContain(userId);
  });

  it('computes turnover, GGR, open liability, and the singles/accas split across every bet', async () => {
    // WON: stake 50, payout 100 -> GGR contribution -50 (house pays out more than staked).
    await prisma.bet.create({
      data: {
        userId,
        brandId,
        stakeCents: 5_000,
        combinedOdds: 2,
        potentialPayoutCents: 10_000,
        settledPayoutCents: 10_000,
        status: 'WON',
        selections: { create: [buildSelectionData()] },
      },
    });
    // LOST: stake 50, payout 0 -> GGR contribution +50 (house keeps the stake).
    await prisma.bet.create({
      data: {
        userId,
        brandId,
        stakeCents: 5_000,
        combinedOdds: 3,
        potentialPayoutCents: 15_000,
        settledPayoutCents: 0,
        status: 'LOST',
        selections: {
          create: [buildSelectionData({ sport: 'Basketball' }), buildSelectionData({ sport: 'Basketball' })],
        },
      },
    });
    // PENDING: stake 20, potential payout 60 -> open liability contribution +40, excluded from GGR.
    await prisma.bet.create({
      data: {
        userId,
        brandId,
        stakeCents: 2_000,
        combinedOdds: 3,
        potentialPayoutCents: 6_000,
        status: 'PENDING',
        selections: { create: [buildSelectionData()] },
      },
    });
    // VOID: fully refunded (payout == stake), so it's included in the GGR
    // aggregate but nets to a 0 contribution - and it's excluded from open
    // liability entirely, since that only ever looks at PENDING bets.
    await prisma.bet.create({
      data: {
        userId,
        brandId,
        stakeCents: 1_000,
        combinedOdds: 2,
        potentialPayoutCents: 2_000,
        settledPayoutCents: 1_000,
        status: 'VOID',
        selections: { create: [buildSelectionData()] },
      },
    });

    const detail = await service.getDetail(brandId, userId);

    expect(detail!.stats.turnoverCents).toBe(5_000 + 5_000 + 2_000 + 1_000);
    expect(detail!.stats.betCount).toBe(4);
    expect(detail!.stats.ggrCents).toBe(-5_000 + 5_000); // WON + LOST only
    expect(detail!.stats.openLiabilityCents).toBe(6_000 - 2_000); // PENDING only
    expect(detail!.stats.singleBetCount).toBe(3); // WON, PENDING, VOID each have 1 selection
    expect(detail!.stats.accumulatorBetCount).toBe(1); // LOST has 2 selections
    expect(detail!.stats.avgSelectionsPerBet).toBeCloseTo((1 + 2 + 1 + 1) / 4);
    expect(detail!.stats.topSports).toEqual([
      { sport: 'Football', count: 3 },
      { sport: 'Basketball', count: 2 },
    ]);
  });

  it('includes campaign name, freebet/insurance/boost flags, and selections on each recent bet', async () => {
    await prisma.bet.create({
      data: {
        userId,
        brandId,
        stakeCents: 5_000,
        combinedOdds: 2,
        potentialPayoutCents: 10_000,
        status: 'PENDING',
        fundedByFreebets: true,
        insuranceCostPercent: 5,
        accaBoostPercent: 10,
        selections: { create: [buildSelectionData()] },
      },
    });

    const detail = await service.getDetail(brandId, userId);

    expect(detail!.recentBets).toHaveLength(1);
    const bet = detail!.recentBets[0]!;
    expect(bet.fundedByFreebets).toBe(true);
    expect(bet.insuranceCostPercent).toBe(5);
    expect(bet.accaBoostPercent).toBe(10);
    expect(bet.selections).toEqual([
      expect.objectContaining({ matchLabel: 'Arsenal vs Chelsea', selectionName: 'Home', status: 'OPEN' }),
    ]);
  });
});

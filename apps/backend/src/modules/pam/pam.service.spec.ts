import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AccaBoostService } from '../acca-boost/acca-boost.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { OddsEngineClient } from '../margins/odds-engine-client';
import { CompetitionSuspensionService } from './competition-suspension.service';
import { MarketSuspensionService } from './market-suspension.service';
import { PamService } from './pam.service';
import type { PlaceBetDto } from './dto/place-bet.dto';

function buildSelection(overrides: Partial<PlaceBetDto['selections'][number]> = {}) {
  return {
    matchId: 'match-1',
    marketId: 'match-result',
    selectionId: 'home',
    matchLabel: 'Arsenal vs Chelsea',
    marketName: 'Match Result',
    selectionName: 'Home',
    odds: 2.1,
    ...overrides,
  };
}

/** Every test matchId resolves to this same fake match/competition - fine since no test relies on per-match competition variation except the competition-suspension tests below, which suspend this exact competition name. */
const DEFAULT_TEST_COMPETITION = 'Test Competition';

function fakeMatch(matchId: string): Match {
  return {
    id: matchId,
    sport: 'Football',
    country: 'Testland',
    competition: DEFAULT_TEST_COMPETITION,
    homeTeam: 'Home',
    awayTeam: 'Away',
    kickoff: new Date().toISOString(),
    isLive: false,
    markets: [],
  };
}

describe('PamService', () => {
  let moduleRef: TestingModule;
  let pamService: PamService;
  let marketSuspensionService: MarketSuspensionService;
  let competitionSuspensionService: CompetitionSuspensionService;
  let accaBoostService: AccaBoostService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let testBrandId: string;
  let otherBrandId: string;
  let TEST_ACTOR: AuditActor;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Test Brand ${unique}`, slug: `test-brand-${unique}` },
    });
    const otherBrand = await setupPrisma.brand.create({
      data: { name: `Other Test Brand ${unique}`, slug: `other-test-brand-${unique}` },
    });
    testBrandId = brand.id;
    otherBrandId = otherBrand.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_trader', brandId: testBrandId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: testBrandId } });
    await setupPrisma.brand.delete({ where: { id: otherBrandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PamService,
        PrismaService,
        AuditLogService,
        MarketSuspensionService,
        CompetitionSuspensionService,
        AccaBoostService,
        {
          provide: OddsEngineClient,
          useValue: { fetchMatchById: vi.fn(async (matchId: string) => fakeMatch(matchId)) },
        },
      ],
    }).compile();
    await moduleRef.init();

    pamService = moduleRef.get(PamService);
    marketSuspensionService = moduleRef.get(MarketSuspensionService);
    competitionSuspensionService = moduleRef.get(CompetitionSuspensionService);
    accaBoostService = moduleRef.get(AccaBoostService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.marketSuspension.deleteMany({ where: { matchId: { startsWith: 'match-' } } });
    await prisma.competitionSuspension.deleteMany({ where: { competition: DEFAULT_TEST_COMPETITION } });
    await prisma.accaBoostConfig.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await prisma.stakeLimit.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    if (createdUserIds.length > 0) {
      await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    await moduleRef.close();
  });

  async function createTestUser(balanceCents = 100_000, brandId = testBrandId): Promise<string> {
    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `test-${unique}@example.com`,
        username: `user_${unique.slice(0, 8)}`,
        phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'irrelevant',
        balanceCents,
        brandId,
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  it('new users start with a paper-money balance', async () => {
    const userId = await createTestUser();
    const wallet = await pamService.getWallet(userId);
    expect(wallet.balanceCents).toBe(100_000);
  });

  it('places a single-selection bet and deducts the stake', async () => {
    const userId = await createTestUser(100_000);

    const bet = await pamService.placeBet(userId, {
      selections: [buildSelection()],
      stakeCents: 1_000,
    });

    expect(bet.stakeCents).toBe(1_000);
    expect(Number(bet.combinedOdds)).toBeCloseTo(2.1);
    expect(bet.potentialPayoutCents).toBe(2_100);
    expect(bet.selections).toHaveLength(1);

    const wallet = await pamService.getWallet(userId);
    expect(wallet.balanceCents).toBe(99_000);
  });

  it('places a combined bet and multiplies the odds across selections', async () => {
    const userId = await createTestUser(100_000);

    const bet = await pamService.placeBet(userId, {
      selections: [
        buildSelection({ matchId: 'match-1', odds: 2.1 }),
        buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 1.5 }),
      ],
      stakeCents: 1_000,
    });

    expect(Number(bet.combinedOdds)).toBeCloseTo(3.15);
    expect(bet.potentialPayoutCents).toBe(3_150);
    expect(bet.selections).toHaveLength(2);
    expect(bet.accaBoostPercent).toBe(0);
  });

  describe('acca boost', () => {
    it('boosts a qualifying accumulator and records the boost percent on the bet', async () => {
      await accaBoostService.setConfig(
        testBrandId,
        { boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: true },
        TEST_ACTOR,
      );
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.0 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 2.0 }),
          buildSelection({ matchId: 'match-3', selectionId: 'away', odds: 2.0 }),
        ],
        stakeCents: 1_000,
      });

      // Base combined = 8. 3 legs x 5% = 15% boost -> 9.2.
      expect(bet.accaBoostPercent).toBe(15);
      expect(Number(bet.combinedOdds)).toBeCloseTo(9.2);
      expect(bet.potentialPayoutCents).toBe(9_200);
    });

    it('does not boost when the accumulator has fewer legs than minSelections', async () => {
      await accaBoostService.setConfig(
        testBrandId,
        { boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: true },
        TEST_ACTOR,
      );
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.0 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 2.0 }),
        ],
        stakeCents: 1_000,
      });

      expect(bet.accaBoostPercent).toBe(0);
      expect(Number(bet.combinedOdds)).toBeCloseTo(4);
    });

    it('does not boost when acca boost is not enabled for the brand', async () => {
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.0 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 2.0 }),
          buildSelection({ matchId: 'match-3', selectionId: 'away', odds: 2.0 }),
        ],
        stakeCents: 1_000,
      });

      expect(bet.accaBoostPercent).toBe(0);
    });

    it('a boosted accumulator still pays the boosted amount at settlement', async () => {
      await accaBoostService.setConfig(
        testBrandId,
        { boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: true },
        TEST_ACTOR,
      );
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.0 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 2.0 }),
          buildSelection({ matchId: 'match-3', selectionId: 'away', odds: 2.0 }),
        ],
        stakeCents: 1_000,
      });

      let settled;
      for (const selection of bet.selections) {
        settled = await pamService.settleSelection(testBrandId, bet.id, selection.id, 'WON', TEST_ACTOR);
      }

      expect(settled!.status).toBe('WON');
      // Same 9.2 boosted odds recomputed at settlement from the legs' own odds + the locked-in 15% boost.
      expect(settled!.settledPayoutCents).toBe(9_200);
    });
  });

  describe('stake limits', () => {
    it('places a bet normally when the brand has no stake limits configured', async () => {
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection()],
        stakeCents: 50_000,
      });

      expect(bet.stakeCents).toBe(50_000);
    });

    it('rejects a stake over the applicable max stake', async () => {
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 1_000 },
      });
      const userId = await createTestUser(100_000);

      await expect(
        pamService.placeBet(userId, { selections: [buildSelection()], stakeCents: 2_000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a stake at or under the applicable max stake', async () => {
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 1_000 },
      });
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection()],
        stakeCents: 1_000,
      });

      expect(bet.stakeCents).toBe(1_000);
    });

    it('rejects a bet whose potential liability exceeds the applicable max liability', async () => {
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'GLOBAL', scopeValue: '', tier: 0, maxLiabilityCents: 1_000 },
      });
      const userId = await createTestUser(100_000);

      // odds 2.1, stake 2000 -> payout 4200, liability 2200 > 1000.
      await expect(
        pamService.placeBet(userId, {
          selections: [buildSelection({ odds: 2.1 })],
          stakeCents: 2_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('an accumulator uses the smallest cap across its legs, not the largest', async () => {
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'MARKET', scopeValue: 'Match Result', tier: 0, maxStakeCents: 100_000 },
      });
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'MARKET', scopeValue: 'Both Teams to Score', tier: 0, maxStakeCents: 40_000 },
      });
      const userId = await createTestUser(100_000);

      // 40 EUR is the smaller of the two legs' own caps (400 EUR vs 1000 EUR) -> 401 EUR rejected, 400 EUR allowed.
      await expect(
        pamService.placeBet(userId, {
          selections: [
            buildSelection({ matchId: 'match-1', marketName: 'Match Result' }),
            buildSelection({ matchId: 'match-2', selectionId: 'yes', marketName: 'Both Teams to Score' }),
          ],
          stakeCents: 40_001,
        }),
      ).rejects.toThrow(BadRequestException);

      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', marketName: 'Match Result' }),
          buildSelection({ matchId: 'match-2', selectionId: 'yes', marketName: 'Both Teams to Score' }),
        ],
        stakeCents: 40_000,
      });
      expect(bet.stakeCents).toBe(40_000);
    });

    it('never applies another brand\'s stake limits', async () => {
      await prisma.stakeLimit.create({
        data: { brandId: otherBrandId, scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 100 },
      });
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection()],
        stakeCents: 50_000,
      });

      expect(bet.stakeCents).toBe(50_000);
    });
  });

  it('rejects placing a bet on a suspended match', async () => {
    const userId = await createTestUser(100_000);
    await marketSuspensionService.suspend(
      testBrandId,
      'match-suspended',
      undefined,
      undefined,
      'kickoff imminent',
      TEST_ACTOR,
    );

    await expect(
      pamService.placeBet(userId, {
        selections: [buildSelection({ matchId: 'match-suspended' })],
        stakeCents: 1_000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const wallet = await pamService.getWallet(userId);
    expect(wallet.balanceCents).toBe(100_000);
  });

  it('rejects placing a bet on a suspended market even if the match itself is not suspended', async () => {
    const userId = await createTestUser(100_000);
    await marketSuspensionService.suspend(
      testBrandId,
      'match-market-suspended',
      'match-result',
      undefined,
      undefined,
      TEST_ACTOR,
    );

    await expect(
      pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-market-suspended', marketId: 'match-result' }),
        ],
        stakeCents: 1_000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A different market on that same match is unaffected.
    const bet = await pamService.placeBet(userId, {
      selections: [buildSelection({ matchId: 'match-market-suspended', marketId: 'total-goals' })],
      stakeCents: 1_000,
    });
    expect(bet.stakeCents).toBe(1_000);
  });

  it('rejects placing a bet on a match whose competition is suspended', async () => {
    const userId = await createTestUser(100_000);
    await competitionSuspensionService.suspend(
      testBrandId,
      DEFAULT_TEST_COMPETITION,
      'integrity concern',
      TEST_ACTOR,
    );

    await expect(
      pamService.placeBet(userId, { selections: [buildSelection()], stakeCents: 1_000 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const wallet = await pamService.getWallet(userId);
    expect(wallet.balanceCents).toBe(100_000);
  });

  it('lifting a competition suspension allows bets on it again', async () => {
    const userId = await createTestUser(100_000);
    const suspension = await competitionSuspensionService.suspend(
      testBrandId,
      DEFAULT_TEST_COMPETITION,
      undefined,
      TEST_ACTOR,
    );
    await competitionSuspensionService.unsuspend(testBrandId, suspension.id, TEST_ACTOR);

    const bet = await pamService.placeBet(userId, {
      selections: [buildSelection()],
      stakeCents: 1_000,
    });
    expect(bet.stakeCents).toBe(1_000);
  });

  it('rejects a bet when the stake exceeds the balance', async () => {
    const userId = await createTestUser(500);

    await expect(
      pamService.placeBet(userId, { selections: [buildSelection()], stakeCents: 1_000 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const wallet = await pamService.getWallet(userId);
    expect(wallet.balanceCents).toBe(500);
  });

  it('lists a user’s bets, most recent first', async () => {
    const userId = await createTestUser(100_000);

    await pamService.placeBet(userId, { selections: [buildSelection()], stakeCents: 500 });
    await pamService.placeBet(userId, {
      selections: [buildSelection({ selectionId: 'away', odds: 3.2 })],
      stakeCents: 700,
    });

    const bets = await pamService.getBets(userId);
    expect(bets).toHaveLength(2);
    expect(bets[0]?.stakeCents).toBe(700);
    expect(bets[1]?.stakeCents).toBe(500);
  });

  describe('settlement', () => {
    it('settling a single-selection bet WON credits the payout to the balance', async () => {
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.1 })],
        stakeCents: 1_000,
      });

      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'WON',
        TEST_ACTOR,
      );

      expect(settled.status).toBe('WON');
      expect(settled.settledPayoutCents).toBe(2_100);
      expect(settled.settledAt).not.toBeNull();

      const auditEntry = await prisma.auditLogEntry.findFirstOrThrow({
        where: { targetType: 'BetSelection', targetId: bet.selections[0]!.id },
      });
      expect(auditEntry.action).toBe('SELECTION_SETTLED');
      expect(auditEntry.actorUsername).toBe(TEST_ACTOR.username);
      expect(auditEntry.metadata).toMatchObject({
        betId: bet.id,
        previousStatus: 'OPEN',
        newStatus: 'WON',
      });

      const wallet = await pamService.getWallet(userId);
      // 100_000 - 1_000 stake + 2_100 payout
      expect(wallet.balanceCents).toBe(101_100);
    });

    it('settling to LOST credits nothing', async () => {
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.1 })],
        stakeCents: 1_000,
      });

      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'LOST',
        TEST_ACTOR,
      );

      expect(settled.status).toBe('LOST');
      expect(settled.settledPayoutCents).toBe(0);

      const wallet = await pamService.getWallet(userId);
      expect(wallet.balanceCents).toBe(99_000);
    });

    it('settling to VOID refunds the stake', async () => {
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.1 })],
        stakeCents: 1_000,
      });

      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'VOID',
        TEST_ACTOR,
      );

      expect(settled.status).toBe('VOID');
      expect(settled.settledPayoutCents).toBe(1_000);

      const wallet = await pamService.getWallet(userId);
      expect(wallet.balanceCents).toBe(100_000);
    });

    it('a combo bet stays PENDING until every leg is settled', async () => {
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.1 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 3.2 }),
        ],
        stakeCents: 1_000,
      });

      const afterFirstLeg = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'WON',
        TEST_ACTOR,
      );
      expect(afterFirstLeg.status).toBe('PENDING');
      expect(afterFirstLeg.settledPayoutCents).toBeNull();

      const walletMidway = await pamService.getWallet(userId);
      expect(walletMidway.balanceCents).toBe(99_000);

      const afterSecondLeg = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[1]!.id,
        'WON',
        TEST_ACTOR,
      );
      expect(afterSecondLeg.status).toBe('WON');
      // 2.1 * 3.2 = 6.72
      expect(afterSecondLeg.settledPayoutCents).toBe(6_720);

      const walletFinal = await pamService.getWallet(userId);
      expect(walletFinal.balanceCents).toBe(99_000 + 6_720);
    });

    it('a single LOST leg kills the whole combo even if another leg already settled WON', async () => {
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.1 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 3.2 }),
        ],
        stakeCents: 1_000,
      });

      await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'WON',
        TEST_ACTOR,
      );
      const final = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[1]!.id,
        'LOST',
        TEST_ACTOR,
      );

      expect(final.status).toBe('LOST');
      expect(final.settledPayoutCents).toBe(0);

      // Settling one leg never touches another leg's own status - the WON
      // leg stays WON in its own record even though it lost it the bet.
      const wonLeg = final.selections.find((selection) => selection.id === bet.selections[0]!.id);
      const lostLeg = final.selections.find((selection) => selection.id === bet.selections[1]!.id);
      expect(wonLeg?.status).toBe('WON');
      expect(lostLeg?.status).toBe('LOST');

      const wallet = await pamService.getWallet(userId);
      // Just the original stake deduction - no payout ever credited.
      expect(wallet.balanceCents).toBe(99_000);
    });

    it('reopening a settled selection claws back the previously credited payout', async () => {
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.1 })],
        stakeCents: 1_000,
      });

      await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'WON',
        TEST_ACTOR,
      );
      expect((await pamService.getWallet(userId)).balanceCents).toBe(101_100);

      const reopened = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'OPEN',
        TEST_ACTOR,
      );

      expect(reopened.status).toBe('PENDING');
      expect(reopened.settledPayoutCents).toBeNull();
      // Clawed back the 2,100 payout, leaving just the original stake deduction.
      expect((await pamService.getWallet(userId)).balanceCents).toBe(99_000);
    });

    it('correcting a WON settlement to LOST claws back the payout', async () => {
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.1 })],
        stakeCents: 1_000,
      });

      await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'WON',
        TEST_ACTOR,
      );
      expect((await pamService.getWallet(userId)).balanceCents).toBe(101_100);

      await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'LOST',
        TEST_ACTOR,
      );
      expect((await pamService.getWallet(userId)).balanceCents).toBe(99_000);
    });

    it('lists bets filtered by status for admin settlement', async () => {
      const userId = await createTestUser(100_000);
      const pendingBet = await pamService.placeBet(userId, {
        selections: [buildSelection()],
        stakeCents: 500,
      });
      const wonBet = await pamService.placeBet(userId, {
        selections: [buildSelection({ selectionId: 'away', odds: 3.2 })],
        stakeCents: 700,
      });
      await pamService.settleSelection(
        testBrandId,
        wonBet.id,
        wonBet.selections[0]!.id,
        'WON',
        TEST_ACTOR,
      );

      const pendingBets = await pamService.listBetsForSettlement(testBrandId, 'PENDING');
      expect(pendingBets.map((bet) => bet.id)).toContain(pendingBet.id);
      expect(pendingBets.map((bet) => bet.id)).not.toContain(wonBet.id);

      const wonBets = await pamService.listBetsForSettlement(testBrandId, 'WON');
      expect(wonBets.map((bet) => bet.id)).toContain(wonBet.id);
      expect(wonBets.map((bet) => bet.id)).not.toContain(pendingBet.id);
    });

    it("never lists another brand's bets for settlement", async () => {
      const otherBrandUserId = await createTestUser(100_000, otherBrandId);
      const otherBrandBet = await pamService.placeBet(otherBrandUserId, {
        selections: [buildSelection({ matchId: 'match-other-brand' })],
        stakeCents: 500,
      });

      const pendingBets = await pamService.listBetsForSettlement(testBrandId, 'PENDING');
      expect(pendingBets.map((bet) => bet.id)).not.toContain(otherBrandBet.id);
    });

    it("never settles another brand's bet, even by guessing its id", async () => {
      const otherBrandUserId = await createTestUser(100_000, otherBrandId);
      const otherBrandBet = await pamService.placeBet(otherBrandUserId, {
        selections: [buildSelection({ matchId: 'match-other-brand-2' })],
        stakeCents: 500,
      });

      await expect(
        pamService.settleSelection(
          testBrandId,
          otherBrandBet.id,
          otherBrandBet.selections[0]!.id,
          'WON',
          TEST_ACTOR,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      const wallet = await pamService.getWallet(otherBrandUserId);
      expect(wallet.balanceCents).toBe(99_500); // stake deducted, never settled
    });
  });
});

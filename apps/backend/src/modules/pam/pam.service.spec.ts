import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AccaBoostService } from '../acca-boost/acca-boost.service';
import { AccaRollbackService } from '../acca-rollback/acca-rollback.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { BetAndGetCampaignService } from '../bet-and-get/bet-and-get-campaign.service';
import { BoostService } from '../boosts/boost.service';
import { OddsLadderService } from '../boosts/odds-ladder.service';
import { DepositCampaignService } from '../deposit-campaigns/deposit-campaign.service';
import { FreebetService } from '../freebets/freebet.service';
import { InsuranceBetService } from '../insurance-bet/insurance-bet.service';
import { ManualMarketService } from '../manual-markets/manual-market.service';
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
  let oddsEngineClient: OddsEngineClient;
  let marketSuspensionService: MarketSuspensionService;
  let competitionSuspensionService: CompetitionSuspensionService;
  let accaBoostService: AccaBoostService;
  let accaRollbackService: AccaRollbackService;
  let insuranceBetService: InsuranceBetService;
  let manualMarketService: ManualMarketService;
  let boostService: BoostService;
  let freebetService: FreebetService;
  let betAndGetCampaignService: BetAndGetCampaignService;
  let depositCampaignService: DepositCampaignService;
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
        AccaRollbackService,
        InsuranceBetService,
        ManualMarketService,
        BoostService,
        OddsLadderService,
        FreebetService,
        BetAndGetCampaignService,
        DepositCampaignService,
        {
          provide: OddsEngineClient,
          useValue: { fetchMatchById: vi.fn(async (matchId: string) => fakeMatch(matchId)) },
        },
      ],
    }).compile();
    await moduleRef.init();

    pamService = moduleRef.get(PamService);
    oddsEngineClient = moduleRef.get(OddsEngineClient);
    marketSuspensionService = moduleRef.get(MarketSuspensionService);
    competitionSuspensionService = moduleRef.get(CompetitionSuspensionService);
    accaBoostService = moduleRef.get(AccaBoostService);
    accaRollbackService = moduleRef.get(AccaRollbackService);
    insuranceBetService = moduleRef.get(InsuranceBetService);
    manualMarketService = moduleRef.get(ManualMarketService);
    boostService = moduleRef.get(BoostService);
    freebetService = moduleRef.get(FreebetService);
    betAndGetCampaignService = moduleRef.get(BetAndGetCampaignService);
    depositCampaignService = moduleRef.get(DepositCampaignService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.marketSuspension.deleteMany({ where: { matchId: { startsWith: 'match-' } } });
    await prisma.competitionSuspension.deleteMany({ where: { competition: DEFAULT_TEST_COMPETITION } });
    await prisma.accaBoostConfig.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await prisma.accaRollbackConfig.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await prisma.insuranceBetConfig.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await prisma.stakeLimit.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await prisma.manualMarket.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await prisma.boost.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await prisma.betAndGetCampaign.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await prisma.depositCampaign.deleteMany({ where: { brandId: { in: [testBrandId, otherBrandId] } } });
    await prisma.auditLogEntry.deleteMany({
      where: {
        actorUsername: {
          in: [TEST_ACTOR.username, 'system:boost-auto-disable', 'system:acca_rollback', 'system:insurance_bet'],
        },
      },
    });
    if (createdUserIds.length > 0) {
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

  it("getFreebets returns the player's own active freebets", async () => {
    const userId = await createTestUser();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await freebetService.grant(testBrandId, { identifier: user.username, amountCents: 1_000 }, TEST_ACTOR);

    const freebets = await pamService.getFreebets(userId);
    expect(freebets).toHaveLength(1);
    expect(freebets[0]?.amountCents).toBe(1_000);
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

    it('never boosts a bet the player insured, to avoid double-bonusing', async () => {
      await accaBoostService.setConfig(
        testBrandId,
        { boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: true },
        TEST_ACTOR,
      );
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.0 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 2.0 }),
          buildSelection({ matchId: 'match-3', selectionId: 'away', odds: 2.0 }),
        ],
        stakeCents: 1_000,
        insuranceOptIn: true,
      });

      expect(bet.accaBoostPercent).toBe(0);
      expect(Number(bet.combinedOdds)).toBeCloseTo(8);
      // Base payout 8_000, un-boosted -> then 10% insurance cost -> 7_200.
      expect(bet.potentialPayoutCents).toBe(7_200);
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

    it('a PLAYER-scoped row overrides the ordinary MARKET cascade for that player', async () => {
      const userId = await createTestUser(100_000);
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'MARKET', scopeValue: 'Match Result', tier: 0, maxStakeCents: 1_000 },
      });
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'PLAYER', scopeValue: userId, tier: 0, maxStakeCents: 10_000 },
      });

      // 5000 exceeds the MARKET cap (1000) but is under the PLAYER cap (10000) - the player override wins.
      const bet = await pamService.placeBet(userId, { selections: [buildSelection()], stakeCents: 5_000 });
      expect(bet.stakeCents).toBe(5_000);

      // Only 5000 of headroom remains under the 10000 player cap now that the first bet is PENDING.
      await expect(
        pamService.placeBet(userId, { selections: [buildSelection()], stakeCents: 5_001 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('a PLAYER row does not apply to a different player', async () => {
      const targetUserId = await createTestUser(100_000);
      const otherUserId = await createTestUser(100_000);
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'PLAYER', scopeValue: targetUserId, tier: 0, maxStakeCents: 1_000 },
      });

      const bet = await pamService.placeBet(otherUserId, { selections: [buildSelection()], stakeCents: 50_000 });
      expect(bet.stakeCents).toBe(50_000);
    });

    it('a player\'s existing PENDING exposure shrinks their remaining PLAYER-cap headroom', async () => {
      const userId = await createTestUser(100_000);
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'PLAYER', scopeValue: userId, tier: 0, maxStakeCents: 10_000 },
      });

      const firstBet = await pamService.placeBet(userId, {
        selections: [buildSelection()],
        stakeCents: 7_000,
      });
      expect(firstBet.stakeCents).toBe(7_000);

      // Only 3000 of headroom remains under the 10000 player cap.
      await expect(
        pamService.placeBet(userId, { selections: [buildSelection()], stakeCents: 3_001 }),
      ).rejects.toThrow(BadRequestException);

      const secondBet = await pamService.placeBet(userId, {
        selections: [buildSelection()],
        stakeCents: 3_000,
      });
      expect(secondBet.stakeCents).toBe(3_000);
    });
  });

  describe('previewStakeLimit', () => {
    it('returns all-null when the brand has no stake limits configured', async () => {
      const preview = await pamService.previewStakeLimit(null, testBrandId, [buildSelection()]);
      expect(preview).toEqual({ maxStakeCents: null, maxLiabilityCents: null, effectiveMaxStakeCents: null });
    });

    it('reflects a plain stake cap from the cascade', async () => {
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 5_000 },
      });

      const preview = await pamService.previewStakeLimit(null, testBrandId, [buildSelection()]);
      expect(preview.maxStakeCents).toBe(5_000);
      expect(preview.effectiveMaxStakeCents).toBe(5_000);
    });

    it('reverses a liability cap into stake terms using the bet\'s own combined odds', async () => {
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'GLOBAL', scopeValue: '', tier: 0, maxLiabilityCents: 2_000 },
      });

      // odds 3 -> combinedOdds 3 -> maxStake = floor(2000 / (3 - 1)) = 1000.
      const preview = await pamService.previewStakeLimit(null, testBrandId, [buildSelection({ odds: 3 })]);
      expect(preview.maxLiabilityCents).toBe(2_000);
      expect(preview.maxStakeCents).toBeNull();
      expect(preview.effectiveMaxStakeCents).toBe(1_000);
    });

    it('effectiveMaxStakeCents is the smaller of the stake cap and the liability-derived cap', async () => {
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 900, maxLiabilityCents: 2_000 },
      });

      // Liability-derived cap (1000) is larger than the plain stake cap (900), so 900 wins.
      const preview = await pamService.previewStakeLimit(null, testBrandId, [buildSelection({ odds: 3 })]);
      expect(preview.effectiveMaxStakeCents).toBe(900);
    });

    it('a PLAYER row is applied when a userId is supplied', async () => {
      const userId = await createTestUser(100_000);
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'PLAYER', scopeValue: userId, tier: 0, maxStakeCents: 2_500 },
      });

      const preview = await pamService.previewStakeLimit(userId, testBrandId, [buildSelection()]);
      expect(preview.maxStakeCents).toBe(2_500);
    });

    it('a PLAYER row never applies for an anonymous (null userId) preview', async () => {
      const userId = await createTestUser(100_000);
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'PLAYER', scopeValue: userId, tier: 0, maxStakeCents: 2_500 },
      });

      const preview = await pamService.previewStakeLimit(null, testBrandId, [buildSelection()]);
      expect(preview).toEqual({ maxStakeCents: null, maxLiabilityCents: null, effectiveMaxStakeCents: null });
    });

    it('a player\'s existing PENDING exposure reduces the previewed headroom', async () => {
      const userId = await createTestUser(100_000);
      await prisma.stakeLimit.create({
        data: { brandId: testBrandId, scope: 'PLAYER', scopeValue: userId, tier: 0, maxStakeCents: 10_000 },
      });
      await pamService.placeBet(userId, { selections: [buildSelection()], stakeCents: 4_000 });

      const preview = await pamService.previewStakeLimit(userId, testBrandId, [buildSelection()]);
      expect(preview.maxStakeCents).toBe(6_000);
    });
  });

  describe('same-event accumulators', () => {
    it('rejects two selections from different markets on the same event combined in an accumulator', async () => {
      const userId = await createTestUser(100_000);

      await expect(
        pamService.placeBet(userId, {
          selections: [
            buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' }),
            buildSelection({ matchId: 'match-1', marketId: 'total-goals', selectionId: 'over' }),
          ],
          stakeCents: 1_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a same-event market as the only selection', async () => {
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ matchId: 'match-1', marketId: 'total-goals', selectionId: 'over' })],
        stakeCents: 1_000,
      });
      expect(bet.stakeCents).toBe(1_000);
    });

    it('allows an accumulator across different events', async () => {
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' }),
          buildSelection({ matchId: 'match-2', marketId: 'match-result', selectionId: 'away' }),
        ],
        stakeCents: 1_000,
      });
      expect(bet.stakeCents).toBe(1_000);
    });
  });

  describe('manual market limits', () => {
    it('places a bet normally on a manual market with no limits configured', async () => {
      const market = await manualMarketService.createMarket(testBrandId, 'match-1', 'Novelty', [
        { name: 'Yes', odds: 2.1 },
      ], TEST_ACTOR);
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ marketId: market.id })],
        stakeCents: 5_000,
      });

      expect(bet.stakeCents).toBe(5_000);
    });

    it('rejects a stake over the market\'s own max stake', async () => {
      const market = await manualMarketService.createMarket(testBrandId, 'match-1', 'Novelty', [
        { name: 'Yes', odds: 2.1 },
      ], TEST_ACTOR);
      await manualMarketService.setLimits(testBrandId, market.id, { maxStakeCents: 1_000 }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      await expect(
        pamService.placeBet(userId, {
          selections: [buildSelection({ marketId: market.id })],
          stakeCents: 2_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a bet that would push the market past its max liability', async () => {
      const market = await manualMarketService.createMarket(testBrandId, 'match-1', 'Novelty', [
        { name: 'Yes', odds: 2.1 },
      ], TEST_ACTOR);
      await manualMarketService.setLimits(testBrandId, market.id, { maxLiabilityCents: 1_000 }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      // odds 2.1, stake 2000 -> leg liability 2200 > 1000.
      await expect(
        pamService.placeBet(userId, {
          selections: [buildSelection({ marketId: market.id, odds: 2.1 })],
          stakeCents: 2_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("accumulates liability across bets and rejects once further bets would exceed the cap", async () => {
      const market = await manualMarketService.createMarket(testBrandId, 'match-1', 'Novelty', [
        { name: 'Yes', odds: 2.0 },
      ], TEST_ACTOR);
      await manualMarketService.setLimits(testBrandId, market.id, { maxLiabilityCents: 1_500 }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      // First bet: stake 1000 @ odds 2.0 -> liability 1000, within cap.
      await pamService.placeBet(userId, {
        selections: [buildSelection({ marketId: market.id, odds: 2.0 })],
        stakeCents: 1_000,
      });

      // Second bet would add another 1000 liability -> 2000 total > 1500 cap.
      await expect(
        pamService.placeBet(userId, {
          selections: [buildSelection({ marketId: market.id, odds: 2.0 })],
          stakeCents: 1_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-disables the market once accumulated liability reaches the cap, and stops applying its limits to further bets', async () => {
      const market = await manualMarketService.createMarket(testBrandId, 'match-1', 'Novelty', [
        { name: 'Yes', odds: 2.0 },
      ], TEST_ACTOR);
      await manualMarketService.setLimits(testBrandId, market.id, { maxLiabilityCents: 1_000 }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      // stake 1000 @ odds 2.0 -> liability 1000, exactly the cap - allowed, and disables the market afterwards.
      await pamService.placeBet(userId, {
        selections: [buildSelection({ marketId: market.id, odds: 2.0 })],
        stakeCents: 1_000,
      });

      const disabled = await prisma.manualMarket.findUniqueOrThrow({ where: { id: market.id } });
      expect(disabled.disabledAt).not.toBeNull();

      // The market is now disabled, so findForBet no longer finds it - a further bet on the same market places normally, uncapped.
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ marketId: market.id, odds: 2.0 })],
        stakeCents: 50_000,
      });
      expect(bet.stakeCents).toBe(50_000);
    });

    it('rejects a bet on a manual market once its match is in-play, unless staysLiveDuringInplay is set', async () => {
      const market = await manualMarketService.createMarket(testBrandId, 'live-match', 'Novelty', [
        { name: 'Yes', odds: 2.1 },
      ], TEST_ACTOR);
      const userId = await createTestUser(100_000);
      vi.mocked(oddsEngineClient.fetchMatchById).mockImplementation(async (matchId: string) => ({
        ...fakeMatch(matchId),
        isLive: matchId === 'live-match',
      }));

      await expect(
        pamService.placeBet(userId, {
          selections: [buildSelection({ matchId: 'live-match', marketId: market.id })],
          stakeCents: 1_000,
        }),
      ).rejects.toThrow(BadRequestException);

      await manualMarketService.setLimits(testBrandId, market.id, { staysLiveDuringInplay: true }, TEST_ACTOR);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ matchId: 'live-match', marketId: market.id })],
        stakeCents: 1_000,
      });
      expect(bet.stakeCents).toBe(1_000);
    });

    it('never applies another brand\'s manual market limits', async () => {
      const market = await manualMarketService.createMarket(otherBrandId, 'match-1', 'Novelty', [
        { name: 'Yes', odds: 2.1 },
      ], TEST_ACTOR);
      await manualMarketService.setLimits(otherBrandId, market.id, { maxStakeCents: 100 }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        // Same marketId as the other brand's manual market, but this bet's own brand has no such market -
        // findForBet returns null, so no limit applies at all.
        selections: [buildSelection({ marketId: market.id })],
        stakeCents: 50_000,
      });

      expect(bet.stakeCents).toBe(50_000);
    });

    it('rejects a singles-only manual market combined with another selection in an accumulator', async () => {
      const market = await manualMarketService.createMarket(testBrandId, 'match-1', 'Novelty', [
        { name: 'Yes', odds: 2.1 },
      ], TEST_ACTOR);
      await manualMarketService.setLimits(testBrandId, market.id, { singlesOnly: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      await expect(
        pamService.placeBet(userId, {
          selections: [
            buildSelection({ matchId: 'match-1', marketId: market.id }),
            buildSelection({ matchId: 'match-2', selectionId: 'away' }),
          ],
          stakeCents: 1_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a singles-only manual market as a lone selection', async () => {
      const market = await manualMarketService.createMarket(testBrandId, 'match-1', 'Novelty', [
        { name: 'Yes', odds: 2.1 },
      ], TEST_ACTOR);
      await manualMarketService.setLimits(testBrandId, market.id, { singlesOnly: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ matchId: 'match-1', marketId: market.id })],
        stakeCents: 1_000,
      });
      expect(bet.stakeCents).toBe(1_000);
    });
  });

  describe('boost limits', () => {
    it('places a bet normally on a boosted selection with no limits configured', async () => {
      await boostService.setBoost(testBrandId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' })],
        stakeCents: 5_000,
      });

      expect(bet.stakeCents).toBe(5_000);
    });

    it("rejects a stake over the boost's own max stake", async () => {
      const boost = await boostService.setBoost(testBrandId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      await boostService.setLimits(testBrandId, boost.id, { maxStakeCents: 1_000 }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      await expect(
        pamService.placeBet(userId, {
          selections: [buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' })],
          stakeCents: 2_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a bet that would push the boost past its max liability', async () => {
      const boost = await boostService.setBoost(testBrandId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      await boostService.setLimits(testBrandId, boost.id, { maxLiabilityCents: 1_000 }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      // odds 2.1, stake 2000 -> leg liability 2200 > 1000.
      await expect(
        pamService.placeBet(userId, {
          selections: [
            buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home', odds: 2.1 }),
          ],
          stakeCents: 2_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-disables the boost once accumulated liability reaches the cap, and stops applying its limits to further bets', async () => {
      const boost = await boostService.setBoost(testBrandId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      await boostService.setLimits(testBrandId, boost.id, { maxLiabilityCents: 1_000 }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      // stake 1000 @ odds 2.0 -> liability 1000, exactly the cap - allowed, and disables the boost afterwards.
      await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home', odds: 2.0 }),
        ],
        stakeCents: 1_000,
      });

      const disabled = await prisma.boost.findUniqueOrThrow({ where: { id: boost.id } });
      expect(disabled.disabledAt).not.toBeNull();

      // The boost is now disabled, so findActiveForBet no longer finds it - a further bet on the same selection places normally, uncapped.
      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home', odds: 2.0 }),
        ],
        stakeCents: 50_000,
      });
      expect(bet.stakeCents).toBe(50_000);
    });

    it('rejects a bet on a boosted price once its match is in-play, unless staysLiveDuringInplay is set', async () => {
      const boost = await boostService.setBoost(testBrandId, 'live-match', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      const userId = await createTestUser(100_000);
      vi.mocked(oddsEngineClient.fetchMatchById).mockImplementation(async (matchId: string) => ({
        ...fakeMatch(matchId),
        isLive: matchId === 'live-match',
      }));

      await expect(
        pamService.placeBet(userId, {
          selections: [
            buildSelection({ matchId: 'live-match', marketId: 'match-result', selectionId: 'home' }),
          ],
          stakeCents: 1_000,
        }),
      ).rejects.toThrow(BadRequestException);

      await boostService.setLimits(testBrandId, boost.id, { staysLiveDuringInplay: true }, TEST_ACTOR);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ matchId: 'live-match', marketId: 'match-result', selectionId: 'home' })],
        stakeCents: 1_000,
      });
      expect(bet.stakeCents).toBe(1_000);
    });

    it("never applies another brand's boost limits", async () => {
      const boost = await boostService.setBoost(otherBrandId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      await boostService.setLimits(otherBrandId, boost.id, { maxStakeCents: 100 }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        // Same natural key as the other brand's boost, but this bet's own brand has no such boost -
        // findActiveForBet returns null, so no limit applies at all.
        selections: [buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' })],
        stakeCents: 50_000,
      });

      expect(bet.stakeCents).toBe(50_000);
    });

    it('rejects an accumulator that combines two boosted selections', async () => {
      await boostService.setBoost(testBrandId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      await boostService.setBoost(testBrandId, 'match-2', 'match-result', 'away', 6, undefined, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      await expect(
        pamService.placeBet(userId, {
          selections: [
            buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home', odds: 6 }),
            buildSelection({ matchId: 'match-2', marketId: 'match-result', selectionId: 'away', odds: 6 }),
          ],
          stakeCents: 1_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows an accumulator that combines one boosted selection with unboosted ones', async () => {
      await boostService.setBoost(testBrandId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home', odds: 6 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 2 }),
        ],
        stakeCents: 1_000,
      });
      expect(bet.stakeCents).toBe(1_000);
    });
  });

  describe('freebets', () => {
    it('funds a bet with the freebets pool instead of the cash balance, and disables acca boost', async () => {
      await accaBoostService.setConfig(
        testBrandId,
        { boostPercentPerLeg: 5, minSelections: 2, minOddsPerLeg: 1.2, enabled: true },
        TEST_ACTOR,
      );
      const userId = await createTestUser(100_000);
      const grant = await freebetService.grant(
        testBrandId,
        { identifier: (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).username, amountCents: 1_000 },
        TEST_ACTOR,
      );

      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.1 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 1.5 }),
        ],
        stakeCents: 1_000,
        useFreebets: true,
      });

      // Cash balance untouched - the freebets pool funded the stake, not the player's own money.
      const wallet = await pamService.getWallet(userId);
      expect(wallet.balanceCents).toBe(100_000);

      // Acca boost never applies to a freebet-funded bet, even though this accumulator qualifies.
      expect(bet.accaBoostPercent).toBe(0);
      expect(Number(bet.combinedOdds)).toBeCloseTo(3.15);

      const spentGrant = await prisma.freebetGrant.findUniqueOrThrow({ where: { id: grant.id } });
      expect(spentGrant.status).toBe('SPENT');
      expect(spentGrant.remainingCents).toBe(0);
    });

    it('acts like a wallet: a typed stake smaller than the grant draws it down and leaves the remainder spendable', async () => {
      const userId = await createTestUser(100_000);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const grant = await freebetService.grant(testBrandId, { identifier: user.username, amountCents: 1_000 }, TEST_ACTOR);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection()],
        stakeCents: 300,
        useFreebets: true,
      });

      expect(bet.stakeCents).toBe(300);
      const partiallySpent = await prisma.freebetGrant.findUniqueOrThrow({ where: { id: grant.id } });
      expect(partiallySpent.status).toBe('ACTIVE');
      expect(partiallySpent.remainingCents).toBe(700);
      expect(await pamService.getFreebets(userId).then((freebets) => freebets[0]!.remainingCents)).toBe(700);
    });

    it('rejects a stake that exceeds the freebets balance', async () => {
      const userId = await createTestUser(100_000);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await freebetService.grant(testBrandId, { identifier: user.username, amountCents: 1_000 }, TEST_ACTOR);

      await expect(
        pamService.placeBet(userId, {
          selections: [buildSelection()],
          stakeCents: 1_500,
          useFreebets: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects useFreebets once the only grant has been voided', async () => {
      const userId = await createTestUser(100_000);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const grant = await freebetService.grant(testBrandId, { identifier: user.username, amountCents: 1_000 }, TEST_ACTOR);
      await freebetService.void(testBrandId, grant.id, TEST_ACTOR);

      await expect(
        pamService.placeBet(userId, {
          selections: [buildSelection()],
          stakeCents: 1_000,
          useFreebets: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('bet & get', () => {
    async function createEnabledCampaign(
      overrides: Partial<Parameters<typeof betAndGetCampaignService.create>[1]> = {},
    ) {
      const campaign = await betAndGetCampaignService.create(
        testBrandId,
        { name: 'CL Bet & Get', rewardAmountCents: 500, ...overrides },
        TEST_ACTOR,
      );
      await betAndGetCampaignService.setScopes(
        testBrandId,
        campaign.id,
        [{ scopeType: 'SPORT', scopeValue: 'Football' }],
        TEST_ACTOR,
      );
      return betAndGetCampaignService.update(testBrandId, campaign.id, { enabled: true }, TEST_ACTOR);
    }

    it('grants the reward immediately at placement for a PLACEMENT-trigger campaign', async () => {
      const campaign = await createEnabledCampaign({ trigger: 'PLACEMENT' });
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      expect(bet.betAndGetCampaignId).toBe(campaign.id);
      const grant = await prisma.freebetGrant.findFirstOrThrow({ where: { sourceBetId: bet.id, source: 'BET_AND_GET' } });
      expect(grant.amountCents).toBe(500);
      expect(grant.sourceCampaignId).toBe(campaign.id);
      expect(grant.userId).toBe(userId);
    });

    it('defers the reward to settlement for a SETTLEMENT-trigger campaign, granting only on the configured outcome', async () => {
      const campaign = await createEnabledCampaign({ trigger: 'SETTLEMENT', triggerOnLost: true });
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      expect(bet.betAndGetCampaignId).toBe(campaign.id);
      expect(await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id, source: 'BET_AND_GET' } })).toBeNull();

      const settled = await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'LOST', TEST_ACTOR);

      expect(settled.status).toBe('LOST');
      const grant = await prisma.freebetGrant.findFirstOrThrow({ where: { sourceBetId: bet.id, source: 'BET_AND_GET' } });
      expect(grant.amountCents).toBe(500);
      expect(grant.sourceCampaignId).toBe(campaign.id);
    });

    it('never grants a SETTLEMENT-trigger campaign on an outcome its flags do not cover', async () => {
      await createEnabledCampaign({ trigger: 'SETTLEMENT', triggerOnLost: true });
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'WON', TEST_ACTOR);

      expect(await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id, source: 'BET_AND_GET' } })).toBeNull();
    });

    it('never links a bet to a campaign once the player has exhausted their redemptions', async () => {
      const campaign = await createEnabledCampaign({ trigger: 'PLACEMENT' });
      const userId = await createTestUser(100_000);
      await prisma.freebetGrant.create({
        data: {
          userId,
          brandId: testBrandId,
          amountCents: 500,
          remainingCents: 500,
          source: 'BET_AND_GET',
          sourceCampaignId: campaign.id,
        },
      });

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      expect(bet.betAndGetCampaignId).toBeNull();
      expect(await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id, source: 'BET_AND_GET' } })).toBeNull();
    });

    it('never links a bet whose selections fall outside every enabled campaign\'s scope', async () => {
      await createEnabledCampaign({ trigger: 'PLACEMENT' });
      const userId = await createTestUser(100_000);

      // fakeMatch always returns sport: 'Football', so use a second leg on a
      // different match id but still Football - swap the scope to Basketball
      // instead so this bet falls outside it.
      const campaign = await betAndGetCampaignService.list(testBrandId);
      await betAndGetCampaignService.setScopes(
        testBrandId,
        campaign[0]!.id,
        [{ scopeType: 'SPORT', scopeValue: 'Basketball' }],
        TEST_ACTOR,
      );

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      expect(bet.betAndGetCampaignId).toBeNull();
    });
  });

  describe('deposit campaign bet requirement', () => {
    /** Creates an enabled, requiresBet campaign plus a Deposit + PENDING_BET redemption for it - mirrors what DepositService would have created at deposit time, without needing a real deposit here. */
    async function createPendingRedemption(
      userId: string,
      overrides: Partial<Parameters<typeof depositCampaignService.create>[1]> = {},
    ) {
      const campaign = await depositCampaignService.create(
        testBrandId,
        {
          name: 'Deposit + Bet',
          minDepositAmountCents: 1_000,
          rewardType: 'FIXED',
          fixedRewardAmountCents: 500,
          requiresBet: true,
          trigger: 'PLACEMENT',
          ...overrides,
        },
        TEST_ACTOR,
      );
      await depositCampaignService.update(testBrandId, campaign.id, { enabled: true }, TEST_ACTOR);
      const deposit = await prisma.deposit.create({ data: { userId, brandId: testBrandId, amountCents: 1_000 } });
      const redemption = await prisma.depositCampaignRedemption.create({
        data: {
          depositCampaignId: campaign.id,
          userId,
          brandId: testBrandId,
          depositId: deposit.id,
          rewardAmountCents: 500,
          status: 'PENDING_BET',
        },
      });
      return { campaign, redemption };
    }

    it('grants the reward immediately at placement for a PLACEMENT-trigger campaign', async () => {
      const userId = await createTestUser(100_000);
      const { campaign } = await createPendingRedemption(userId, { trigger: 'PLACEMENT' });

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      expect(bet.depositCampaignRedemptionId).not.toBeNull();
      const grant = await prisma.freebetGrant.findFirstOrThrow({
        where: { sourceBetId: bet.id, source: 'DEPOSIT_CAMPAIGN' },
      });
      expect(grant.amountCents).toBe(500);
      expect(grant.sourceCampaignId).toBe(campaign.id);

      const redemption = await prisma.depositCampaignRedemption.findUniqueOrThrow({
        where: { id: bet.depositCampaignRedemptionId! },
      });
      expect(redemption.status).toBe('GRANTED');
    });

    it('defers the reward to settlement for a SETTLEMENT-trigger campaign, granting only on the configured outcome', async () => {
      const userId = await createTestUser(100_000);
      await createPendingRedemption(userId, { trigger: 'SETTLEMENT', triggerOnLost: true });

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      expect(
        await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id, source: 'DEPOSIT_CAMPAIGN' } }),
      ).toBeNull();
      const pending = await prisma.depositCampaignRedemption.findUniqueOrThrow({
        where: { id: bet.depositCampaignRedemptionId! },
      });
      expect(pending.status).toBe('PENDING_SETTLEMENT');

      const settled = await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'LOST', TEST_ACTOR);
      expect(settled.status).toBe('LOST');

      const grant = await prisma.freebetGrant.findFirstOrThrow({
        where: { sourceBetId: bet.id, source: 'DEPOSIT_CAMPAIGN' },
      });
      expect(grant.amountCents).toBe(500);

      const redemption = await prisma.depositCampaignRedemption.findUniqueOrThrow({
        where: { id: bet.depositCampaignRedemptionId! },
      });
      expect(redemption.status).toBe('GRANTED');
    });

    it('never grants a SETTLEMENT-trigger campaign on an outcome its flags do not cover', async () => {
      const userId = await createTestUser(100_000);
      await createPendingRedemption(userId, { trigger: 'SETTLEMENT', triggerOnLost: true });

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'WON', TEST_ACTOR);

      expect(
        await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id, source: 'DEPOSIT_CAMPAIGN' } }),
      ).toBeNull();
    });

    it("never matches a bet that fails the campaign's own conditions, leaving the redemption pending for a later bet", async () => {
      const userId = await createTestUser(100_000);
      const { redemption } = await createPendingRedemption(userId, { minStakeCents: 5_000 });

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      expect(bet.depositCampaignRedemptionId).toBeNull();
      const stillPending = await prisma.depositCampaignRedemption.findUniqueOrThrow({ where: { id: redemption.id } });
      expect(stillPending.status).toBe('PENDING_BET');
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

  it('getBets enriches each bet with its acca rollback reward and campaign names, derived rather than stored on Bet', async () => {
    await accaRollbackService.setConfig(
      testBrandId,
      { minSelections: 2, lossThreshold: 1, rewardPercent: 100, enabled: true },
      TEST_ACTOR,
    );
    const campaign = await betAndGetCampaignService.create(
      testBrandId,
      { name: 'CL Bet & Get', rewardAmountCents: 500 },
      TEST_ACTOR,
    );
    await betAndGetCampaignService.setScopes(
      testBrandId,
      campaign.id,
      [{ scopeType: 'SPORT', scopeValue: 'Football' }],
      TEST_ACTOR,
    );
    await betAndGetCampaignService.update(testBrandId, campaign.id, { enabled: true }, TEST_ACTOR);

    const userId = await createTestUser(100_000);
    const plainBet = await pamService.placeBet(userId, {
      selections: [buildSelection({ odds: 2.0 })],
      stakeCents: 1_000,
    });
    expect(plainBet.betAndGetCampaignId).toBe(campaign.id);

    const rollbackBet = await pamService.placeBet(userId, {
      selections: [
        buildSelection({ matchId: 'match-1', odds: 2.0 }),
        buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 2.0 }),
      ],
      stakeCents: 500,
    });
    await pamService.settleSelection(testBrandId, rollbackBet.id, rollbackBet.selections[0]!.id, 'WON', TEST_ACTOR);
    await pamService.settleSelection(testBrandId, rollbackBet.id, rollbackBet.selections[1]!.id, 'LOST', TEST_ACTOR);

    const bets = await pamService.getBets(userId);
    const enrichedPlainBet = bets.find((bet) => bet.id === plainBet.id)!;
    expect(enrichedPlainBet.betAndGetCampaignName).toBe('CL Bet & Get');
    expect(enrichedPlainBet.depositCampaignName).toBeNull();
    expect(enrichedPlainBet.accaRollbackRewardCents).toBeNull();

    const enrichedRollbackBet = bets.find((bet) => bet.id === rollbackBet.id)!;
    expect(enrichedRollbackBet.accaRollbackRewardCents).toBe(500);
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

    it('a freebet-funded bet that WINs credits the full payout when the brand returns the stake on win (default)', async () => {
      const userId = await createTestUser(100_000);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const grant = await freebetService.grant(testBrandId, { identifier: user.username, amountCents: 1_000 }, TEST_ACTOR);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.1 })],
        stakeCents: 1_000,
        useFreebets: true,
      });

      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'WON',
        TEST_ACTOR,
      );

      // Brand.freebetStakeReturnedOnWin defaults to true - the full raw
      // payout (stake * odds = 2_100) is credited, stake included, same as
      // a cash-funded bet.
      expect(settled.settledPayoutCents).toBe(2_100);
      const wallet = await pamService.getWallet(userId);
      // Balance was never debited at placement (freebet-funded), so it gains the whole payout.
      expect(wallet.balanceCents).toBe(102_100);
    });

    it('a freebet-funded bet that WINs credits only the profit when the brand opts out of returning the stake', async () => {
      const userId = await createTestUser(100_000);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await prisma.brand.update({ where: { id: testBrandId }, data: { freebetStakeReturnedOnWin: false } });
      const grant = await freebetService.grant(testBrandId, { identifier: user.username, amountCents: 1_000 }, TEST_ACTOR);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.1 })],
        stakeCents: 1_000,
        useFreebets: true,
      });

      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'WON',
        TEST_ACTOR,
      );

      // Raw payout would be 2_100 (stake * odds) - with the stake withheld,
      // only the 1_100 profit on top of it is credited.
      expect(settled.settledPayoutCents).toBe(1_100);
      const wallet = await pamService.getWallet(userId);
      expect(wallet.balanceCents).toBe(101_100);

      await prisma.brand.update({ where: { id: testBrandId }, data: { freebetStakeReturnedOnWin: true } });
    });

    it('a freebet-funded bet that LOSEs credits nothing and never touched the cash balance', async () => {
      const userId = await createTestUser(100_000);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const grant = await freebetService.grant(testBrandId, { identifier: user.username, amountCents: 1_000 }, TEST_ACTOR);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.1 })],
        stakeCents: 1_000,
        useFreebets: true,
      });

      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'LOST',
        TEST_ACTOR,
      );

      expect(settled.settledPayoutCents).toBe(0);
      const wallet = await pamService.getWallet(userId);
      expect(wallet.balanceCents).toBe(100_000);
    });

    it('a freebet-funded bet that VOIDs credits nothing - the stake was never the player’s own cash', async () => {
      const userId = await createTestUser(100_000);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const grant = await freebetService.grant(testBrandId, { identifier: user.username, amountCents: 1_000 }, TEST_ACTOR);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.1 })],
        stakeCents: 1_000,
        useFreebets: true,
      });

      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'VOID',
        TEST_ACTOR,
      );

      expect(settled.settledPayoutCents).toBe(0);
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

  describe('acca rollback', () => {
    it('grants a freebet for the lost stake when a qualifying accumulator loses by no more than lossThreshold legs', async () => {
      await accaRollbackService.setConfig(
        testBrandId,
        { minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: true },
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

      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'WON', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[1]!.id, 'WON', TEST_ACTOR);
      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[2]!.id,
        'LOST',
        TEST_ACTOR,
      );

      expect(settled.status).toBe('LOST');
      const grant = await prisma.freebetGrant.findFirstOrThrow({ where: { sourceBetId: bet.id } });
      expect(grant.source).toBe('ACCA_ROLLBACK');
      expect(grant.amountCents).toBe(1_000);
      expect(grant.userId).toBe(userId);
    });

    it('does not grant a reward while sibling legs are still open, even though the bet is already overall LOST', async () => {
      await accaRollbackService.setConfig(
        testBrandId,
        { minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: true },
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

      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'LOST',
        TEST_ACTOR,
      );

      expect(settled.status).toBe('LOST');
      const grant = await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id } });
      expect(grant).toBeNull();
    });

    it('does not grant a reward when more legs lost than lossThreshold allows', async () => {
      await accaRollbackService.setConfig(
        testBrandId,
        { minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: true },
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

      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'LOST', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[1]!.id, 'LOST', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[2]!.id, 'WON', TEST_ACTOR);

      const grant = await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id } });
      expect(grant).toBeNull();
    });

    it('does not grant a reward when acca rollback is not enabled for the brand', async () => {
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.0 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 2.0 }),
          buildSelection({ matchId: 'match-3', selectionId: 'away', odds: 2.0 }),
        ],
        stakeCents: 1_000,
      });

      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'WON', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[1]!.id, 'WON', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[2]!.id, 'LOST', TEST_ACTOR);

      const grant = await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id } });
      expect(grant).toBeNull();
    });

    it('does not grant a reward for a freebet-funded accumulator, to avoid double-bonusing', async () => {
      await accaRollbackService.setConfig(
        testBrandId,
        { minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: true },
        TEST_ACTOR,
      );
      const userId = await createTestUser(100_000);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await freebetService.grant(testBrandId, { identifier: user.username, amountCents: 1_000 }, TEST_ACTOR);
      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.0 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 2.0 }),
          buildSelection({ matchId: 'match-3', selectionId: 'away', odds: 2.0 }),
        ],
        stakeCents: 1_000,
        useFreebets: true,
      });

      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'WON', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[1]!.id, 'WON', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[2]!.id, 'LOST', TEST_ACTOR);

      const rollbackGrant = await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id } });
      expect(rollbackGrant).toBeNull();
    });

    it('does not grant a rollback reward for an insured accumulator, to avoid double-bonusing', async () => {
      await accaRollbackService.setConfig(
        testBrandId,
        { minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: true },
        TEST_ACTOR,
      );
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [
          buildSelection({ matchId: 'match-1', odds: 2.0 }),
          buildSelection({ matchId: 'match-2', selectionId: 'away', odds: 2.0 }),
          buildSelection({ matchId: 'match-3', selectionId: 'away', odds: 2.0 }),
        ],
        stakeCents: 1_000,
        insuranceOptIn: true,
      });

      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'WON', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[1]!.id, 'WON', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[2]!.id, 'LOST', TEST_ACTOR);

      // Insurance itself still refunds the stake as a freebet (source
      // INSURANCE_BET) - only the rollback reward (source ACCA_ROLLBACK)
      // is the one that must never additionally fire.
      const rollbackGrant = await prisma.freebetGrant.findFirst({
        where: { sourceBetId: bet.id, source: 'ACCA_ROLLBACK' },
      });
      expect(rollbackGrant).toBeNull();
      const insuranceGrant = await prisma.freebetGrant.findFirstOrThrow({
        where: { sourceBetId: bet.id, source: 'INSURANCE_BET' },
      });
      expect(insuranceGrant.amountCents).toBe(1_000);
    });

    it('is idempotent - re-settling the same losing leg never grants the reward twice', async () => {
      await accaRollbackService.setConfig(
        testBrandId,
        { minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: true },
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

      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'WON', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[1]!.id, 'WON', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[2]!.id, 'LOST', TEST_ACTOR);
      // A correction re-settle, same terminal status.
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[2]!.id, 'LOST', TEST_ACTOR);

      const grants = await prisma.freebetGrant.findMany({ where: { sourceBetId: bet.id } });
      expect(grants).toHaveLength(1);
    });
  });

  describe('insurance bet', () => {
    it('reduces the potential payout by costPercent when opted in and enabled', async () => {
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
        insuranceOptIn: true,
      });

      expect(bet.insuranceCostPercent).toBe(10);
      // Raw payout would be 2_000 - 10% cost -> 1_800.
      expect(bet.potentialPayoutCents).toBe(1_800);
    });

    it('does not reduce the payout when not opted in', async () => {
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      expect(bet.insuranceCostPercent).toBe(0);
      expect(bet.potentialPayoutCents).toBe(2_000);
    });

    it('does not reduce the payout when insurance is disabled for the brand, even if opted in', async () => {
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
        insuranceOptIn: true,
      });

      expect(bet.insuranceCostPercent).toBe(0);
      expect(bet.potentialPayoutCents).toBe(2_000);
    });

    it('never applies insurance to a freebet-funded bet, to avoid double-bonusing', async () => {
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const grant = await freebetService.grant(testBrandId, { identifier: user.username, amountCents: 1_000 }, TEST_ACTOR);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
        useFreebets: true,
        insuranceOptIn: true,
      });

      expect(bet.insuranceCostPercent).toBe(0);
      expect(bet.potentialPayoutCents).toBe(2_000);
    });

    it('rejects insurance opt-in on a boosted selection', async () => {
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      await boostService.setBoost(testBrandId, 'match-1', 'match-result', 'home', 6, undefined, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      await expect(
        pamService.placeBet(userId, {
          selections: [buildSelection({ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' })],
          stakeCents: 1_000,
          insuranceOptIn: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects insurance opt-in on a singles-only manual market', async () => {
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const market = await manualMarketService.createMarket(testBrandId, 'match-1', 'Novelty', [
        { name: 'Yes', odds: 2.1 },
      ], TEST_ACTOR);
      await manualMarketService.setLimits(testBrandId, market.id, { singlesOnly: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      await expect(
        pamService.placeBet(userId, {
          selections: [buildSelection({ matchId: 'match-1', marketId: market.id })],
          stakeCents: 1_000,
          insuranceOptIn: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows insurance opt-in on an ordinary (non-boosted, non-singles-only) selection', async () => {
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);

      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
        insuranceOptIn: true,
      });

      expect(bet.insuranceCostPercent).toBe(10);
    });

    it('refunds the stake as a freebet when an insured bet loses', async () => {
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
        insuranceOptIn: true,
      });

      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'LOST',
        TEST_ACTOR,
      );

      expect(settled.status).toBe('LOST');
      const grant = await prisma.freebetGrant.findFirstOrThrow({ where: { sourceBetId: bet.id } });
      expect(grant.source).toBe('INSURANCE_BET');
      expect(grant.amountCents).toBe(1_000);
      expect(grant.userId).toBe(userId);
    });

    it('does not refund when an insured bet wins, and pays out the already-discounted amount', async () => {
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
        insuranceOptIn: true,
      });

      const settled = await pamService.settleSelection(
        testBrandId,
        bet.id,
        bet.selections[0]!.id,
        'WON',
        TEST_ACTOR,
      );

      expect(settled.status).toBe('WON');
      // Raw payout 2_000 -> 10% insurance cost -> 1_800 credited.
      expect(settled.settledPayoutCents).toBe(1_800);
      const grant = await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id } });
      expect(grant).toBeNull();
    });

    it('does not refund when insurance was not opted into, even if the bet loses', async () => {
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
      });

      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'LOST', TEST_ACTOR);

      const grant = await prisma.freebetGrant.findFirst({ where: { sourceBetId: bet.id } });
      expect(grant).toBeNull();
    });

    it('is idempotent - re-settling the same loss never grants the reward twice', async () => {
      await insuranceBetService.setConfig(testBrandId, { costPercent: 10, enabled: true }, TEST_ACTOR);
      const userId = await createTestUser(100_000);
      const bet = await pamService.placeBet(userId, {
        selections: [buildSelection({ odds: 2.0 })],
        stakeCents: 1_000,
        insuranceOptIn: true,
      });

      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'LOST', TEST_ACTOR);
      await pamService.settleSelection(testBrandId, bet.id, bet.selections[0]!.id, 'LOST', TEST_ACTOR);

      const grants = await prisma.freebetGrant.findMany({ where: { sourceBetId: bet.id } });
      expect(grants).toHaveLength(1);
    });
  });
});

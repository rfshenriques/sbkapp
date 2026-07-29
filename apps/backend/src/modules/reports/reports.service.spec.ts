import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AccaBoostService } from '../acca-boost/acca-boost.service';
import { AccaRollbackService } from '../acca-rollback/acca-rollback.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { BetAndGetCampaignService } from '../bet-and-get/bet-and-get-campaign.service';
import { DepositCampaignService } from '../deposit-campaigns/deposit-campaign.service';
import { InsuranceBetService } from '../insurance-bet/insurance-bet.service';
import { LeaderboardCampaignService } from '../leaderboards/leaderboard-campaign.service';
import { BoostService } from '../boosts/boost.service';
import { OddsLadderService } from '../boosts/odds-ladder.service';
import { FreebetService } from '../freebets/freebet.service';
import { ManualMarketService } from '../manual-markets/manual-market.service';
import { OddsEngineClient } from '../margins/odds-engine-client';
import { PlayerSegmentService } from '../player-segments/player-segment.service';
import { PushNotificationService } from '../push/push-notification.service';
import { RegisterCampaignService } from '../register-campaigns/register-campaign.service';
import { CompetitionSuspensionService } from '../pam/competition-suspension.service';
import { MarketSuspensionService } from '../pam/market-suspension.service';
import { PamService } from '../pam/pam.service';
import type { PlaceBetDto } from '../pam/dto/place-bet.dto';
import { ReportsService } from './reports.service';

function buildSelection(overrides: Partial<PlaceBetDto['selections'][number]> = {}) {
  return {
    matchId: 'match-reports-1',
    marketId: 'match-result',
    selectionId: 'home',
    matchLabel: 'Arsenal vs Chelsea',
    marketName: 'Match Result',
    selectionName: 'Home',
    odds: 2,
    ...overrides,
  };
}

describe('ReportsService', () => {
  let moduleRef: TestingModule;
  let reportsService: ReportsService;
  let pamService: PamService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let testBrandId: string;
  let ACTOR_A: AuditActor;
  let ACTOR_B: AuditActor;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Test Brand ${unique}`, slug: `test-brand-${unique}` },
    });
    testBrandId = brand.id;
    ACTOR_A = { id: 'staff-a', username: 'test_reports_trader_a', brandId: testBrandId };
    ACTOR_B = { id: 'staff-b', username: 'test_reports_trader_b', brandId: testBrandId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: testBrandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
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
        RegisterCampaignService,
        LeaderboardCampaignService,
        PlayerSegmentService,
        PushNotificationService,
        {
          provide: OddsEngineClient,
          useValue: {
            fetchMatchById: vi.fn(
              async (matchId: string): Promise<Match> => ({
                id: matchId,
                sport: 'Football',
                country: 'Testland',
                competition: 'Test Competition',
                homeTeam: 'Home',
                awayTeam: 'Away',
                kickoff: new Date().toISOString(),
                isLive: false,
                markets: [],
              }),
            ),
          },
        },
      ],
    }).compile();
    await moduleRef.init();

    reportsService = moduleRef.get(ReportsService);
    pamService = moduleRef.get(PamService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [ACTOR_A.username, ACTOR_B.username] } },
    });
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    await moduleRef.close();
  });

  async function createTestUser(): Promise<string> {
    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `test-${unique}@example.com`,
        username: `user_${unique.slice(0, 8)}`,
        phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'irrelevant',
        balanceCents: 1_000_000,
        brandId: testBrandId,
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  it('summarizes stake, settled payout, and GGR across bets in a status breakdown', async () => {
    const userId = await createTestUser();
    const from = new Date();

    const wonBet = await pamService.placeBet(userId, {
      selections: [buildSelection({ odds: 2 })],
      stakeCents: 1_000,
    });
    await pamService.settleSelection(
      testBrandId,
      wonBet.id,
      wonBet.selections[0]!.id,
      'WON',
      ACTOR_A,
    );

    const lostBet = await pamService.placeBet(userId, {
      selections: [buildSelection({ matchId: 'match-reports-2', odds: 3 })],
      stakeCents: 500,
    });
    await pamService.settleSelection(
      testBrandId,
      lostBet.id,
      lostBet.selections[0]!.id,
      'LOST',
      ACTOR_A,
    );

    await pamService.placeBet(userId, {
      selections: [buildSelection({ matchId: 'match-reports-3', odds: 1.5 })],
      stakeCents: 300,
    });

    const summary = await reportsService.getSummary(testBrandId, { from });

    expect(summary.betCount).toBe(3);
    expect(summary.totalStakeCents).toBe(1_800);
    expect(summary.settledBetCount).toBe(2);
    expect(summary.settledStakeCents).toBe(1_500);
    expect(summary.settledPayoutCents).toBe(2_000);
    expect(summary.ggrCents).toBe(-500);

    const wonBreakdown = summary.statusBreakdown.find((entry) => entry.status === 'WON');
    const lostBreakdown = summary.statusBreakdown.find((entry) => entry.status === 'LOST');
    const pendingBreakdown = summary.statusBreakdown.find((entry) => entry.status === 'PENDING');
    expect(wonBreakdown).toMatchObject({ count: 1, stakeCents: 1_000 });
    expect(lostBreakdown).toMatchObject({ count: 1, stakeCents: 500 });
    expect(pendingBreakdown).toMatchObject({ count: 1, stakeCents: 300 });

    const emptyFutureSummary = await reportsService.getSummary(testBrandId, {
      from: new Date('2999-01-01'),
    });
    expect(emptyFutureSummary.betCount).toBe(0);
    expect(emptyFutureSummary.ggrCents).toBe(0);
  });

  it('computes GGR as settled stake minus settled payout, excluding PENDING bets', async () => {
    const userId = await createTestUser();
    const from = new Date();

    const wonBet = await pamService.placeBet(userId, {
      selections: [buildSelection({ matchId: 'match-reports-ggr', odds: 2 })],
      stakeCents: 1_000,
    });
    await pamService.settleSelection(
      testBrandId,
      wonBet.id,
      wonBet.selections[0]!.id,
      'WON',
      ACTOR_A,
    );

    await pamService.placeBet(userId, {
      selections: [buildSelection({ matchId: 'match-reports-ggr-pending', odds: 5 })],
      stakeCents: 10_000,
    });

    const summary = await reportsService.getSummary(testBrandId, { from });

    expect(summary.betCount).toBe(2);
    expect(summary.settledBetCount).toBe(1);
    expect(summary.settledStakeCents).toBe(1_000);
    expect(summary.settledPayoutCents).toBe(2_000);
    // 1,000 stake - 2,000 payout = -1,000 GGR; the 10,000 PENDING stake is excluded.
    expect(summary.ggrCents).toBe(-1_000);
  });

  it('reports staff settlement activity grouped by actor', async () => {
    const userId = await createTestUser();

    const betOne = await pamService.placeBet(userId, {
      selections: [buildSelection({ matchId: 'match-reports-activity-1' })],
      stakeCents: 100,
    });
    await pamService.settleSelection(
      testBrandId,
      betOne.id,
      betOne.selections[0]!.id,
      'WON',
      ACTOR_A,
    );

    const betTwo = await pamService.placeBet(userId, {
      selections: [buildSelection({ matchId: 'match-reports-activity-2' })],
      stakeCents: 100,
    });
    await pamService.settleSelection(
      testBrandId,
      betTwo.id,
      betTwo.selections[0]!.id,
      'LOST',
      ACTOR_A,
    );

    const betThree = await pamService.placeBet(userId, {
      selections: [buildSelection({ matchId: 'match-reports-activity-3' })],
      stakeCents: 100,
    });
    await pamService.settleSelection(
      testBrandId,
      betThree.id,
      betThree.selections[0]!.id,
      'WON',
      ACTOR_B,
    );

    const activity = await reportsService.getStaffActivity(testBrandId, {});

    const actorAEntry = activity.find((entry) => entry.actorUsername === ACTOR_A.username);
    const actorBEntry = activity.find((entry) => entry.actorUsername === ACTOR_B.username);
    expect(actorAEntry?.settlementCount).toBe(2);
    expect(actorBEntry?.settlementCount).toBe(1);
  });

  it('buckets registrations by day', async () => {
    await prisma.user.update({
      where: { id: await createTestUser() },
      data: { createdAt: new Date('2026-07-01T10:00:00Z') },
    });
    const secondUserId = await createTestUser();
    await prisma.user.update({
      where: { id: secondUserId },
      data: { createdAt: new Date('2026-07-01T18:00:00Z') },
    });
    const thirdUserId = await createTestUser();
    await prisma.user.update({
      where: { id: thirdUserId },
      data: { createdAt: new Date('2026-07-02T09:00:00Z') },
    });

    const series = await reportsService.getRegistrationsTimeSeries(
      testBrandId,
      { from: new Date('2026-07-01T00:00:00Z'), to: new Date('2026-07-02T23:59:59Z') },
      'day',
    );

    expect(series).toEqual([
      { bucket: new Date('2026-07-01T00:00:00Z').toISOString(), count: 2 },
      { bucket: new Date('2026-07-02T00:00:00Z').toISOString(), count: 1 },
    ]);
  });

  it('returns an empty registrations series for a range with no signups', async () => {
    const series = await reportsService.getRegistrationsTimeSeries(
      testBrandId,
      { from: new Date('2999-01-01'), to: new Date('2999-01-31') },
      'day',
    );
    expect(series).toEqual([]);
  });

  it('rejects an invalid granularity', async () => {
    await expect(
      reportsService.getRegistrationsTimeSeries(testBrandId, {}, 'year' as never),
    ).rejects.toThrow('Invalid granularity');
  });

  it('buckets GGR by day, based on when the bet settled', async () => {
    const userId = await createTestUser();

    const wonBet = await pamService.placeBet(userId, {
      selections: [buildSelection({ matchId: 'match-reports-ts-1', odds: 2 })],
      stakeCents: 1_000,
    });
    await pamService.settleSelection(testBrandId, wonBet.id, wonBet.selections[0]!.id, 'WON', ACTOR_A);
    await prisma.bet.update({ where: { id: wonBet.id }, data: { settledAt: new Date('2026-07-01T12:00:00Z') } });

    const lostBet = await pamService.placeBet(userId, {
      selections: [buildSelection({ matchId: 'match-reports-ts-2', odds: 3 })],
      stakeCents: 500,
    });
    await pamService.settleSelection(testBrandId, lostBet.id, lostBet.selections[0]!.id, 'LOST', ACTOR_A);
    await prisma.bet.update({ where: { id: lostBet.id }, data: { settledAt: new Date('2026-07-02T09:00:00Z') } });

    const series = await reportsService.getGgrTimeSeries(
      testBrandId,
      { from: new Date('2026-07-01T00:00:00Z'), to: new Date('2026-07-02T23:59:59Z') },
      'day',
    );

    expect(series).toEqual([
      { bucket: new Date('2026-07-01T00:00:00Z').toISOString(), ggrCents: -1_000 },
      { bucket: new Date('2026-07-02T00:00:00Z').toISOString(), ggrCents: 500 },
    ]);
  });
});

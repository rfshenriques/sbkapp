import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
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
});

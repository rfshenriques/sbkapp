import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
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

describe('PamService', () => {
  let moduleRef: TestingModule;
  let pamService: PamService;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [PamService, PrismaService],
    }).compile();
    await moduleRef.init();

    pamService = moduleRef.get(PamService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    await moduleRef.close();
  });

  async function createTestUser(balanceCents = 100_000): Promise<string> {
    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `test-${unique}@example.com`,
        username: `user_${unique.slice(0, 8)}`,
        phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'irrelevant',
        balanceCents,
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

      const settled = await pamService.settleSelection(bet.id, bet.selections[0]!.id, 'WON');

      expect(settled.status).toBe('WON');
      expect(settled.settledPayoutCents).toBe(2_100);
      expect(settled.settledAt).not.toBeNull();

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

      const settled = await pamService.settleSelection(bet.id, bet.selections[0]!.id, 'LOST');

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

      const settled = await pamService.settleSelection(bet.id, bet.selections[0]!.id, 'VOID');

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

      const afterFirstLeg = await pamService.settleSelection(bet.id, bet.selections[0]!.id, 'WON');
      expect(afterFirstLeg.status).toBe('PENDING');
      expect(afterFirstLeg.settledPayoutCents).toBeNull();

      const walletMidway = await pamService.getWallet(userId);
      expect(walletMidway.balanceCents).toBe(99_000);

      const afterSecondLeg = await pamService.settleSelection(bet.id, bet.selections[1]!.id, 'WON');
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

      await pamService.settleSelection(bet.id, bet.selections[0]!.id, 'WON');
      const final = await pamService.settleSelection(bet.id, bet.selections[1]!.id, 'LOST');

      expect(final.status).toBe('LOST');
      expect(final.settledPayoutCents).toBe(0);

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

      await pamService.settleSelection(bet.id, bet.selections[0]!.id, 'WON');
      expect((await pamService.getWallet(userId)).balanceCents).toBe(101_100);

      const reopened = await pamService.settleSelection(bet.id, bet.selections[0]!.id, 'OPEN');

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

      await pamService.settleSelection(bet.id, bet.selections[0]!.id, 'WON');
      expect((await pamService.getWallet(userId)).balanceCents).toBe(101_100);

      await pamService.settleSelection(bet.id, bet.selections[0]!.id, 'LOST');
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
      await pamService.settleSelection(wonBet.id, wonBet.selections[0]!.id, 'WON');

      const pendingBets = await pamService.listBetsForSettlement('PENDING');
      expect(pendingBets.map((bet) => bet.id)).toContain(pendingBet.id);
      expect(pendingBets.map((bet) => bet.id)).not.toContain(wonBet.id);

      const wonBets = await pamService.listBetsForSettlement('WON');
      expect(wonBets.map((bet) => bet.id)).toContain(wonBet.id);
      expect(wonBets.map((bet) => bet.id)).not.toContain(pendingBet.id);
    });
  });
});

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
});

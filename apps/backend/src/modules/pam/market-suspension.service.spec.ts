import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { MarketSuspensionService } from './market-suspension.service';

const TEST_ACTOR: AuditActor = { id: 'staff-test-id', username: 'test_trader_suspensions' };

describe('MarketSuspensionService', () => {
  let moduleRef: TestingModule;
  let service: MarketSuspensionService;
  let prisma: PrismaService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [MarketSuspensionService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(MarketSuspensionService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
    await prisma.marketSuspension.deleteMany({ where: { matchId: { startsWith: 'match-' } } });
    await moduleRef.close();
  });

  it('suspending a whole match blocks every market on it', async () => {
    await service.suspend('match-a', undefined, 'weather delay', TEST_ACTOR);

    expect(await service.isSuspended('match-a', 'match-result')).toBe(true);
    expect(await service.isSuspended('match-a', 'total-goals')).toBe(true);
    expect(await service.isSuspended('match-b', 'match-result')).toBe(false);
  });

  it('suspending one market only blocks that market', async () => {
    await service.suspend('match-c', 'match-result', undefined, TEST_ACTOR);

    expect(await service.isSuspended('match-c', 'match-result')).toBe(true);
    expect(await service.isSuspended('match-c', 'total-goals')).toBe(false);
  });

  it('is idempotent - suspending an already-suspended match updates the reason instead of erroring', async () => {
    await service.suspend('match-d', undefined, 'first reason', TEST_ACTOR);
    await service.suspend('match-d', undefined, 'updated reason', TEST_ACTOR);

    const suspensions = await prisma.marketSuspension.findMany({ where: { matchId: 'match-d' } });
    expect(suspensions).toHaveLength(1);
    expect(suspensions[0]?.reason).toBe('updated reason');
  });

  it('unsuspending removes the block', async () => {
    const suspension = await service.suspend('match-e', undefined, undefined, TEST_ACTOR);
    expect(await service.isSuspended('match-e', 'match-result')).toBe(true);

    await service.unsuspend(suspension.id, TEST_ACTOR);
    expect(await service.isSuspended('match-e', 'match-result')).toBe(false);
  });

  it('unsuspending a nonexistent suspension throws NotFoundException', async () => {
    await expect(service.unsuspend('does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records audit entries for suspend and unsuspend', async () => {
    const suspension = await service.suspend('match-f', 'match-result', 'trading call', TEST_ACTOR);
    await service.unsuspend(suspension.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'MARKET_SUSPENDED',
      'MARKET_UNSUSPENDED',
    ]);
    expect(entries[0]?.targetType).toBe('Market');
    expect(entries[0]?.metadata).toMatchObject({
      matchId: 'match-f',
      marketId: 'match-result',
      reason: 'trading call',
    });
  });
});

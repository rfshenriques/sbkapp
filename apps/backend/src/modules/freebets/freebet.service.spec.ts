import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { FreebetService } from './freebet.service';

describe('FreebetService', () => {
  let moduleRef: TestingModule;
  let service: FreebetService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;
  let userId: string;
  let username: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_crm_freebets', brandId: brandAId };
  });

  afterAll(async () => {
    await setupPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [FreebetService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(FreebetService);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    username = `user_${unique.slice(0, 8)}`;
    const user = await prisma.user.create({
      data: {
        email: `test-${unique}@example.com`,
        username,
        phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'irrelevant',
        brandId: brandAId,
      },
    });
    userId = user.id;
    createdUserIds.push(user.id);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
    await prisma.bet.deleteMany({ where: { userId } });
    await prisma.freebetGrant.deleteMany({ where: { userId } });
    await moduleRef.close();
  });

  /** spendFromBalance's BetFreebetDebit rows have a real FK to bets - a bare string id (as the old atomic spend() test data used) would violate it, so tests that spend need a real, if minimal, Bet row to point at. */
  async function createTestBet(): Promise<string> {
    const bet = await prisma.bet.create({
      data: { userId, brandId: brandAId, stakeCents: 1000, combinedOdds: 1.5, potentialPayoutCents: 1500 },
    });
    return bet.id;
  }

  it('grants a freebet by username and lists it back', async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);

    expect(grant.amountCents).toBe(1000);
    expect(grant.status).toBe('ACTIVE');
    expect(grant.source).toBe('MANUAL');

    const listed = await service.list(brandAId, username);
    expect(listed.map((entry) => entry.id)).toEqual([grant.id]);
  });

  it('rejects a non-positive amount', async () => {
    await expect(
      service.grant(brandAId, { identifier: username, amountCents: 0 }, TEST_ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('granting to a nonexistent player throws NotFoundException', async () => {
    await expect(
      service.grant(brandAId, { identifier: 'nobody@example.com', amountCents: 1000 }, TEST_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("a brand can never grant to another brand's player, even by username", async () => {
    await expect(
      service.grant(brandBId, { identifier: username, amountCents: 1000 }, { ...TEST_ACTOR, brandId: brandBId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listActive only returns ACTIVE, unexpired, not-fully-drawn-down grants, oldest-expiring first', async () => {
    const active = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);
    const expired = await service.grant(
      brandAId,
      { identifier: username, amountCents: 500, expiresAt: new Date(Date.now() - 60_000) },
      TEST_ACTOR,
    );
    const exhausted = await service.grant(brandAId, { identifier: username, amountCents: 250 }, TEST_ACTOR);
    // Simulating an already-fully-drawn-down grant directly (rather than via
    // spendFromBalance, which would draw from `active` first since it's
    // older) keeps this test about listActive's own filtering, independent
    // of spend-order behavior covered separately below.
    await prisma.freebetGrant.update({
      where: { id: exhausted.id },
      data: { remainingCents: 0, status: 'SPENT', spentAt: new Date() },
    });

    const activeGrants = await service.listActive(userId, brandAId);
    expect(activeGrants.map((grant) => grant.id)).toEqual([active.id]);
    expect(expired).toBeTruthy();
  });

  it('listActive resolves campaignName for BET_AND_GET and DEPOSIT_CAMPAIGN grants, null otherwise', async () => {
    const betAndGetCampaign = await prisma.betAndGetCampaign.create({
      data: { brandId: brandAId, name: 'Weekend Boost', rewardAmountCents: 500 },
    });
    const depositCampaign = await prisma.depositCampaign.create({
      data: {
        brandId: brandAId,
        name: 'First Deposit Bonus',
        minDepositAmountCents: 1000,
        rewardType: 'FIXED',
        fixedRewardAmountCents: 2000,
      },
    });

    await service.grantSystem({
      userId,
      brandId: brandAId,
      amountCents: 500,
      source: 'BET_AND_GET',
      sourceCampaignId: betAndGetCampaign.id,
    });
    await service.grantSystem({
      userId,
      brandId: brandAId,
      amountCents: 2000,
      source: 'DEPOSIT_CAMPAIGN',
      sourceCampaignId: depositCampaign.id,
    });
    await service.grantSystem({ userId, brandId: brandAId, amountCents: 100, source: 'ACCA_ROLLBACK' });

    const activeGrants = await service.listActive(userId, brandAId);
    const byCampaignId = new Map(activeGrants.map((grant) => [grant.sourceCampaignId, grant.campaignName]));
    expect(byCampaignId.get(betAndGetCampaign.id)).toBe('Weekend Boost');
    expect(byCampaignId.get(depositCampaign.id)).toBe('First Deposit Bonus');
    expect(activeGrants.find((grant) => grant.source === 'ACCA_ROLLBACK')?.campaignName).toBeNull();

    await prisma.betAndGetCampaign.delete({ where: { id: betAndGetCampaign.id } });
    await prisma.depositCampaign.delete({ where: { id: depositCampaign.id } });
  });

  it('listUnseen returns every not-yet-notified grant regardless of status/expiry, unlike listActive', async () => {
    const active = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);
    const expired = await service.grant(
      brandAId,
      { identifier: username, amountCents: 500, expiresAt: new Date(Date.now() - 60_000) },
      TEST_ACTOR,
    );
    const voided = await service.grant(brandAId, { identifier: username, amountCents: 250 }, TEST_ACTOR);
    await prisma.freebetGrant.update({
      where: { id: voided.id },
      data: { status: 'VOIDED', voidedAt: new Date() },
    });

    const unseen = await service.listUnseen(userId, brandAId);
    expect(unseen.map((grant) => grant.id).sort()).toEqual([active.id, expired.id, voided.id].sort());
  });

  it('acknowledge sets notifiedAt so a grant drops out of listUnseen, scoped to the given userId', async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);

    await service.acknowledge('a-different-user-id', [grant.id]);
    expect((await service.listUnseen(userId, brandAId)).map((entry) => entry.id)).toEqual([grant.id]);

    await service.acknowledge(userId, [grant.id]);
    expect(await service.listUnseen(userId, brandAId)).toEqual([]);
  });

  it('balanceCents sums only active/unexpired grants remaining balance', async () => {
    await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);
    await service.grant(brandAId, { identifier: username, amountCents: 500 }, TEST_ACTOR);
    const exhausted = await service.grant(brandAId, { identifier: username, amountCents: 250 }, TEST_ACTOR);
    const betId = await createTestBet();
    await service.spendFromBalance(userId, brandAId, 250, betId);
    expect(exhausted).toBeTruthy();

    expect(await service.balanceCents(userId, brandAId)).toBe(1500);
  });

  it('spendFromBalance draws down a single grant that covers the whole amount, leaving it ACTIVE with a smaller remainder', async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);
    const betId = await createTestBet();

    await service.spendFromBalance(userId, brandAId, 300, betId);

    const reloaded = (await service.list(brandAId, username))[0]!;
    expect(reloaded.remainingCents).toBe(700);
    expect(reloaded.status).toBe('ACTIVE');
    expect(await service.balanceCents(userId, brandAId)).toBe(700);
  });

  it('spendFromBalance fully exhausts a grant and marks it SPENT once remainingCents hits 0', async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);
    const betId = await createTestBet();

    await service.spendFromBalance(userId, brandAId, 1000, betId);

    const reloaded = (await service.list(brandAId, username))[0]!;
    expect(reloaded.id).toBe(grant.id);
    expect(reloaded.remainingCents).toBe(0);
    expect(reloaded.status).toBe('SPENT');
    expect(reloaded.spentAt).not.toBeNull();
  });

  it('spendFromBalance spans several grants, oldest-expiring first, when one alone is not enough', async () => {
    const soonExpiring = await service.grant(
      brandAId,
      { identifier: username, amountCents: 400, expiresAt: new Date(Date.now() + 3_600_000) },
      TEST_ACTOR,
    );
    const neverExpires = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);
    const betId = await createTestBet();

    await service.spendFromBalance(userId, brandAId, 500, betId);

    const grants = await service.list(brandAId, username);
    const soonReloaded = grants.find((grant) => grant.id === soonExpiring.id)!;
    const neverReloaded = grants.find((grant) => grant.id === neverExpires.id)!;
    // The soon-expiring grant (400) is drawn down first and fully exhausted; only the remaining 100 comes from the never-expiring one.
    expect(soonReloaded.remainingCents).toBe(0);
    expect(soonReloaded.status).toBe('SPENT');
    expect(neverReloaded.remainingCents).toBe(900);
  });

  it('spendFromBalance throws when the pool cannot cover the full amount', async () => {
    await service.grant(brandAId, { identifier: username, amountCents: 300 }, TEST_ACTOR);
    const betId = await createTestBet();

    await expect(service.spendFromBalance(userId, brandAId, 500, betId)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('void revokes an ACTIVE grant', async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);

    const voided = await service.void(brandAId, grant.id, TEST_ACTOR);
    expect(voided.status).toBe('VOIDED');
    expect(voided.voidedAt).not.toBeNull();

    expect(await service.balanceCents(userId, brandAId)).toBe(0);
  });

  it('void rejects an already fully-spent grant', async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);
    const betId = await createTestBet();
    await service.spendFromBalance(userId, brandAId, 1000, betId);

    await expect(service.void(brandAId, grant.id, TEST_ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("a brand can never void another brand's grant, even by guessing its id", async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);

    await expect(
      service.void(brandBId, grant.id, { ...TEST_ACTOR, brandId: brandBId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

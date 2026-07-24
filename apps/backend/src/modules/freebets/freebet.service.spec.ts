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
    await prisma.freebetGrant.deleteMany({ where: { userId } });
    await moduleRef.close();
  });

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

  it('listActive only returns ACTIVE, unexpired grants', async () => {
    const active = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);
    const expired = await service.grant(
      brandAId,
      { identifier: username, amountCents: 500, expiresAt: new Date(Date.now() - 60_000) },
      TEST_ACTOR,
    );
    const spent = await service.grant(brandAId, { identifier: username, amountCents: 250 }, TEST_ACTOR);
    await service.spend(spent.id, userId, 'bet-1');

    const activeGrants = await service.listActive(userId, brandAId);
    expect(activeGrants.map((grant) => grant.id)).toEqual([active.id]);
    expect(expired).toBeTruthy();
  });

  it('balanceCents sums only active/unexpired grants', async () => {
    await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);
    await service.grant(brandAId, { identifier: username, amountCents: 500 }, TEST_ACTOR);
    const spent = await service.grant(brandAId, { identifier: username, amountCents: 250 }, TEST_ACTOR);
    await service.spend(spent.id, userId, 'bet-1');

    expect(await service.balanceCents(userId, brandAId)).toBe(1500);
  });

  it('spend marks the grant SPENT with the funding bet id, and rejects a second spend', async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);

    const spent = await service.spend(grant.id, userId, 'bet-1');
    expect(spent.status).toBe('SPENT');
    expect(spent.spentOnBetId).toBe('bet-1');
    expect(spent.spentAt).not.toBeNull();

    await expect(service.spend(grant.id, userId, 'bet-2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('spend rejects an expired grant', async () => {
    const grant = await service.grant(
      brandAId,
      { identifier: username, amountCents: 1000, expiresAt: new Date(Date.now() - 60_000) },
      TEST_ACTOR,
    );

    await expect(service.spend(grant.id, userId, 'bet-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it("spend rejects a grant that doesn't belong to the given user", async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);

    await expect(service.spend(grant.id, 'someone-else', 'bet-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('void revokes an ACTIVE grant', async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);

    const voided = await service.void(brandAId, grant.id, TEST_ACTOR);
    expect(voided.status).toBe('VOIDED');
    expect(voided.voidedAt).not.toBeNull();

    expect(await service.balanceCents(userId, brandAId)).toBe(0);
  });

  it('void rejects an already-spent grant', async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);
    await service.spend(grant.id, userId, 'bet-1');

    await expect(service.void(brandAId, grant.id, TEST_ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("a brand can never void another brand's grant, even by guessing its id", async () => {
    const grant = await service.grant(brandAId, { identifier: username, amountCents: 1000 }, TEST_ACTOR);

    await expect(
      service.void(brandBId, grant.id, { ...TEST_ACTOR, brandId: brandBId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

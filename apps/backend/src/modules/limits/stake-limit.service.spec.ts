import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { StakeLimitService } from './stake-limit.service';

describe('StakeLimitService', () => {
  let moduleRef: TestingModule;
  let service: StakeLimitService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-stake-limits-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-stake-limits-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_stake_limits', brandId: brandAId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [StakeLimitService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(StakeLimitService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
    await prisma.stakeLimit.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('starts empty for a brand that has never set a limit', async () => {
    expect(await service.list(brandAId)).toEqual([]);
  });

  it('sets a limit and reads it back', async () => {
    await service.set(
      brandAId,
      { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: 500_000 },
      TEST_ACTOR,
    );

    const rows = await service.list(brandAId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      scope: 'SPORT',
      scopeValue: 'Football',
      tier: 0,
      maxStakeCents: 100_000,
      maxLiabilityCents: 500_000,
    });
  });

  it('is idempotent - setting the same (scope, scopeValue, tier) again updates in place', async () => {
    await service.set(
      brandAId,
      { scope: 'MARKET', scopeValue: 'Match Result', tier: 1, maxStakeCents: 10_000, maxLiabilityCents: null },
      TEST_ACTOR,
    );
    await service.set(
      brandAId,
      { scope: 'MARKET', scopeValue: 'Match Result', tier: 1, maxStakeCents: 20_000, maxLiabilityCents: null },
      TEST_ACTOR,
    );

    const rows = await service.list(brandAId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.maxStakeCents).toBe(20_000);
  });

  it('removes a limit', async () => {
    const row = await service.set(
      brandAId,
      { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
      TEST_ACTOR,
    );

    await service.remove(brandAId, row.id, TEST_ACTOR);

    expect(await service.list(brandAId)).toEqual([]);
  });

  it('refuses to remove another brand\'s limit', async () => {
    const row = await service.set(
      brandAId,
      { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
      TEST_ACTOR,
    );

    await expect(service.remove(brandBId, row.id, TEST_ACTOR)).rejects.toThrow('Stake limit not found');
  });

  it('records an audit entry for set and remove', async () => {
    const row = await service.set(
      brandAId,
      { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
      TEST_ACTOR,
    );
    await service.remove(brandAId, row.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual(['STAKE_LIMIT_SET', 'STAKE_LIMIT_REMOVED']);
  });

  it('is isolated per brand', async () => {
    await service.set(
      brandAId,
      { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
      TEST_ACTOR,
    );

    expect(await service.list(brandBId)).toEqual([]);
  });

  describe('bulkReplace', () => {
    it('upserts every row from the new file', async () => {
      const { count } = await service.bulkReplace(
        brandAId,
        [
          { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
          { scope: 'SPORT', scopeValue: 'Tennis', tier: 0, maxStakeCents: 40_000, maxLiabilityCents: null },
        ],
        TEST_ACTOR,
      );

      expect(count).toBe(2);
      expect(await service.list(brandAId)).toHaveLength(2);
    });

    it('deletes rows that existed before but are absent from the new file - the file is the new source of truth', async () => {
      await service.set(
        brandAId,
        { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
        TEST_ACTOR,
      );
      await service.set(
        brandAId,
        { scope: 'SPORT', scopeValue: 'Tennis', tier: 0, maxStakeCents: 40_000, maxLiabilityCents: null },
        TEST_ACTOR,
      );

      const { removedCount } = await service.bulkReplace(
        brandAId,
        [{ scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 200_000, maxLiabilityCents: null }],
        TEST_ACTOR,
      );

      expect(removedCount).toBe(1);
      const rows = await service.list(brandAId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ scopeValue: 'Football', maxStakeCents: 200_000 });
    });

    it('never touches another brand\'s rows', async () => {
      await service.set(
        brandBId,
        { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
        { ...TEST_ACTOR, brandId: brandBId },
      );

      await service.bulkReplace(brandAId, [], TEST_ACTOR);

      expect(await service.list(brandBId)).toHaveLength(1);
    });
  });

  describe('PLAYER scope', () => {
    let userId: string;
    let username: string;
    let email: string;

    beforeEach(async () => {
      const unique = randomUUID();
      username = `player_${unique.slice(0, 8)}`;
      email = `player-${unique}@example.com`;
      const user = await prisma.user.create({
        data: {
          email,
          username,
          phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
          passwordHash: 'irrelevant',
          brandId: brandAId,
        },
      });
      userId = user.id;
    });

    afterEach(async () => {
      await prisma.user.delete({ where: { id: userId } });
    });

    it('resolves an email identifier to the player\'s userId and stores that as scopeValue', async () => {
      const row = await service.set(
        brandAId,
        { scope: 'PLAYER', scopeValue: email, tier: 0, maxStakeCents: 5_000, maxLiabilityCents: 20_000 },
        TEST_ACTOR,
      );
      expect(row.scopeValue).toBe(userId);
    });

    it('resolves a username identifier the same way', async () => {
      const row = await service.set(
        brandAId,
        { scope: 'PLAYER', scopeValue: username, tier: 0, maxStakeCents: 5_000, maxLiabilityCents: 20_000 },
        TEST_ACTOR,
      );
      expect(row.scopeValue).toBe(userId);
    });

    it('resolves the identifier case-insensitively', async () => {
      const row = await service.set(
        brandAId,
        { scope: 'PLAYER', scopeValue: username.toUpperCase(), tier: 0, maxStakeCents: 5_000, maxLiabilityCents: 20_000 },
        TEST_ACTOR,
      );
      expect(row.scopeValue).toBe(userId);
    });

    it('is idempotent - setting a limit for the same player twice (by different identifiers) updates the same row', async () => {
      await service.set(
        brandAId,
        { scope: 'PLAYER', scopeValue: email, tier: 0, maxStakeCents: 5_000, maxLiabilityCents: null },
        TEST_ACTOR,
      );
      await service.set(
        brandAId,
        { scope: 'PLAYER', scopeValue: username, tier: 0, maxStakeCents: 9_000, maxLiabilityCents: null },
        TEST_ACTOR,
      );

      const rows = await service.list(brandAId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ scopeValue: userId, maxStakeCents: 9_000 });
    });

    it('rejects an identifier that matches no player in this brand', async () => {
      await expect(
        service.set(
          brandAId,
          { scope: 'PLAYER', scopeValue: 'no-such-player@example.com', tier: 0, maxStakeCents: 5_000, maxLiabilityCents: null },
          TEST_ACTOR,
        ),
      ).rejects.toThrow('No player found with that email or username in this brand');
    });

    it('does not resolve a player who belongs to a different brand', async () => {
      await expect(
        service.set(
          brandBId,
          { scope: 'PLAYER', scopeValue: email, tier: 0, maxStakeCents: 5_000, maxLiabilityCents: null },
          { ...TEST_ACTOR, brandId: brandBId },
        ),
      ).rejects.toThrow('No player found with that email or username in this brand');
    });
  });
});

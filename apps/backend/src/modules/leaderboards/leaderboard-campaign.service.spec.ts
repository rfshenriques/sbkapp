import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { ANONYMOUS_VIEWER } from '../audience/audience';
import { FreebetService } from '../freebets/freebet.service';
import { LeaderboardCampaignService } from './leaderboard-campaign.service';

describe('LeaderboardCampaignService', () => {
  let moduleRef: TestingModule;
  let service: LeaderboardCampaignService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;
  let userId: string;
  let otherUserId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-leaderboard-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-leaderboard-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_leaderboard_campaign', brandId: brandAId };
  });

  afterAll(async () => {
    await setupPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [LeaderboardCampaignService, PrismaService, AuditLogService, FreebetService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(LeaderboardCampaignService);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `test-${unique}@example.com`,
        username: `user_${unique.slice(0, 8)}`,
        phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'irrelevant',
        brandId: brandAId,
      },
    });
    userId = user.id;
    createdUserIds.push(user.id);

    const otherUnique = randomUUID();
    const otherUser = await prisma.user.create({
      data: {
        email: `test-${otherUnique}@example.com`,
        username: `user_${otherUnique.slice(0, 8)}`,
        phone: `+1555${otherUnique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'irrelevant',
        brandId: brandAId,
      },
    });
    otherUserId = otherUser.id;
    createdUserIds.push(otherUser.id);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await prisma.freebetGrant.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.leaderboardCampaign.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await prisma.playerSegment.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  const futureEndAt = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const FIXED_INPUT = { name: 'Weekly Leaderboard', endAt: futureEndAt() };

  it('creates a campaign and lists it back', async () => {
    await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);

    const listed = await service.list(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ name: 'Weekly Leaderboard', enabled: false, pointsPerEuroStaked: 1 });
  });

  it("a brand can never update another brand's campaign, even by guessing its id", async () => {
    const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
    await expect(service.update(brandBId, campaign.id, { name: 'Hijacked' }, TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removes a campaign', async () => {
    const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
    await service.remove(brandAId, campaign.id, TEST_ACTOR);
    expect(await service.list(brandAId)).toEqual([]);
  });

  describe('setScopes', () => {
    it('replaces the whole scope list', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      const updated = await service.setScopes(
        brandAId,
        campaign.id,
        [{ scopeType: 'SPORT', scopeValue: 'Football' }],
        TEST_ACTOR,
      );
      expect(updated.scopes).toHaveLength(1);

      const replaced = await service.setScopes(
        brandAId,
        campaign.id,
        [{ scopeType: 'SPORT', scopeValue: 'Basketball' }],
        TEST_ACTOR,
      );
      expect(replaced.scopes).toHaveLength(1);
      expect(replaced.scopes[0]).toMatchObject({ scopeValue: 'Basketball' });
    });
  });

  describe('setRewardTiers', () => {
    it('replaces the whole reward-tier list', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      const updated = await service.setRewardTiers(
        brandAId,
        campaign.id,
        [
          { rankFrom: 1, rankTo: 1, rewardAmountCents: 10_000 },
          { rankFrom: 2, rankTo: 3, rewardAmountCents: 5_000 },
        ],
        TEST_ACTOR,
      );
      expect(updated.rewardTiers).toHaveLength(2);
    });

    it('rejects a tier with rankFrom > rankTo', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await expect(
        service.setRewardTiers(brandAId, campaign.id, [{ rankFrom: 3, rankTo: 1, rewardAmountCents: 1_000 }], TEST_ACTOR),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a tier with rankFrom < 1', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await expect(
        service.setRewardTiers(brandAId, campaign.id, [{ rankFrom: 0, rankTo: 1, rewardAmountCents: 1_000 }], TEST_ACTOR),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects overlapping rank ranges', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await expect(
        service.setRewardTiers(
          brandAId,
          campaign.id,
          [
            { rankFrom: 1, rankTo: 3, rewardAmountCents: 10_000 },
            { rankFrom: 3, rankTo: 5, rewardAmountCents: 5_000 },
          ],
          TEST_ACTOR,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('join', () => {
    it('opts a player in, and is idempotent on repeat calls', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);

      const first = await service.join(brandAId, campaign.id, userId);
      const second = await service.join(brandAId, campaign.id, userId);
      expect(second.id).toBe(first.id);

      const entry = await service.getEntryForUser(campaign.id, userId);
      expect(entry?.id).toBe(first.id);
    });

    it('rejects joining a disabled campaign', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await expect(service.join(brandAId, campaign.id, userId)).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects joining another brand's campaign, even by guessing its id", async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      await expect(service.join(brandBId, campaign.id, userId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resolveLinkableCampaigns', () => {
    const match = { sport: 'Football', competition: 'Premier League', matchId: 'match-1', isLive: false };

    it('only links campaigns the player has already joined', async () => {
      const campaign = await service.create(brandAId, { ...FIXED_INPUT, minStakeCents: null }, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      await service.setScopes(brandAId, campaign.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);

      const beforeJoin = await service.resolveLinkableCampaigns(
        brandAId,
        [match],
        { stakeCents: 1_000, legOdds: [2.0] },
        ANONYMOUS_VIEWER,
        userId,
      );
      expect(beforeJoin).toHaveLength(0);

      await service.join(brandAId, campaign.id, userId);
      const afterJoin = await service.resolveLinkableCampaigns(
        brandAId,
        [match],
        { stakeCents: 1_000, legOdds: [2.0] },
        ANONYMOUS_VIEWER,
        userId,
      );
      expect(afterJoin).toHaveLength(1);
      expect(afterJoin[0]?.campaign.id).toBe(campaign.id);
    });

    it('excludes a joined campaign whose scope does not cover the match', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      await service.setScopes(brandAId, campaign.id, [{ scopeType: 'SPORT', scopeValue: 'Basketball' }], TEST_ACTOR);
      await service.join(brandAId, campaign.id, userId);

      const linked = await service.resolveLinkableCampaigns(
        brandAId,
        [match],
        { stakeCents: 1_000, legOdds: [2.0] },
        ANONYMOUS_VIEWER,
        userId,
      );
      expect(linked).toHaveLength(0);
    });

    it("excludes a joined campaign the bet doesn't meet the conditions of", async () => {
      const campaign = await service.create(brandAId, { ...FIXED_INPUT, minStakeCents: 5_000 }, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      await service.setScopes(brandAId, campaign.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);
      await service.join(brandAId, campaign.id, userId);

      const linked = await service.resolveLinkableCampaigns(
        brandAId,
        [match],
        { stakeCents: 1_000, legOdds: [2.0] },
        ANONYMOUS_VIEWER,
        userId,
      );
      expect(linked).toHaveLength(0);
    });
  });

  describe('getRankedEntries', () => {
    it('orders by pointsTotal desc, then joinedAt asc', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      const entryA = await service.join(brandAId, campaign.id, userId);
      const entryB = await service.join(brandAId, campaign.id, otherUserId);
      await prisma.leaderboardEntry.update({ where: { id: entryB.id }, data: { pointsTotal: 50 } });
      await prisma.leaderboardEntry.update({ where: { id: entryA.id }, data: { pointsTotal: 50 } });

      const ranked = await service.getRankedEntries(campaign.id);
      expect(ranked.map((entry) => entry.id)).toEqual([entryA.id, entryB.id]);
    });
  });

  describe('finalizeIfEnded', () => {
    it('grants tier rewards by rank once the campaign has ended, and never twice', async () => {
      const pastEndAt = new Date(Date.now() - 1000);
      const campaign = await service.create(brandAId, { ...FIXED_INPUT, endAt: futureEndAt() }, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      const entryA = await service.join(brandAId, campaign.id, userId);
      const entryB = await service.join(brandAId, campaign.id, otherUserId);
      await prisma.leaderboardEntry.update({ where: { id: entryA.id }, data: { pointsTotal: 100 } });
      await prisma.leaderboardEntry.update({ where: { id: entryB.id }, data: { pointsTotal: 50 } });
      await service.setRewardTiers(brandAId, campaign.id, [{ rankFrom: 1, rankTo: 1, rewardAmountCents: 5_000 }], TEST_ACTOR);
      await prisma.leaderboardCampaign.update({ where: { id: campaign.id }, data: { endAt: pastEndAt } });

      await service.finalizeIfEnded(campaign.id);

      const grants = await prisma.freebetGrant.findMany({ where: { sourceCampaignId: campaign.id } });
      expect(grants).toHaveLength(1);
      expect(grants[0]).toMatchObject({ userId, amountCents: 5_000, source: 'LEADERBOARD_CAMPAIGN' });

      await service.finalizeIfEnded(campaign.id);
      expect(await prisma.freebetGrant.count({ where: { sourceCampaignId: campaign.id } })).toBe(1);
    });

    it('does nothing before the campaign has ended', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      await service.join(brandAId, campaign.id, userId);
      await service.setRewardTiers(brandAId, campaign.id, [{ rankFrom: 1, rankTo: 1, rewardAmountCents: 5_000 }], TEST_ACTOR);

      await service.finalizeIfEnded(campaign.id);
      expect(await prisma.freebetGrant.count({ where: { sourceCampaignId: campaign.id } })).toBe(0);
    });
  });
});

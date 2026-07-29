import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { ANONYMOUS_VIEWER } from '../audience/audience';
import { RegisterCampaignService } from './register-campaign.service';

describe('RegisterCampaignService', () => {
  let moduleRef: TestingModule;
  let service: RegisterCampaignService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;
  let userId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-register-campaign-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-register-campaign-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_register_campaign', brandId: brandAId };
  });

  afterAll(async () => {
    await setupPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [RegisterCampaignService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(RegisterCampaignService);
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
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
    await prisma.registerCampaignRedemption.deleteMany({ where: { userId } });
    await prisma.registerCampaign.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await prisma.playerSegment.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  const FIXED_INPUT = { name: 'Welcome Bonus', rewardAmountCents: 1_000 };

  it('creates a campaign and lists it back', async () => {
    await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);

    const listed = await service.list(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ name: 'Welcome Bonus', rewardAmountCents: 1_000, enabled: false });
  });

  it('rejects a FIXED campaign missing rewardAmountCents', async () => {
    await expect(service.create(brandAId, { name: 'Welcome Bonus' }, TEST_ACTOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a PERCENTAGE campaign that does not also require a bet', async () => {
    await expect(
      service.create(
        brandAId,
        { name: 'Welcome Bonus', rewardType: 'PERCENTAGE', rewardPercent: 10, rewardCapCents: 2_000 },
        TEST_ACTOR,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects requiresBet without qualifyingBetWindowDays', async () => {
    await expect(
      service.create(brandAId, { name: 'Welcome Bonus', rewardAmountCents: 1_000, requiresBet: true }, TEST_ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a requiresBet + PERCENTAGE campaign when both are configured together', async () => {
    const campaign = await service.create(
      brandAId,
      {
        name: 'Welcome Bonus',
        rewardType: 'PERCENTAGE',
        rewardPercent: 20,
        rewardCapCents: 2_000,
        requiresBet: true,
        qualifyingBetWindowDays: 7,
      },
      TEST_ACTOR,
    );
    expect(campaign).toMatchObject({ rewardType: 'PERCENTAGE', requiresBet: true, qualifyingBetWindowDays: 7 });
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

  describe('canRedeem', () => {
    it('is true with no existing redemption, false once one exists - at most once per player, ever', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      expect(await service.canRedeem(campaign.id, userId)).toBe(true);

      await prisma.registerCampaignRedemption.create({
        data: { registerCampaignId: campaign.id, userId, brandId: brandAId, rewardAmountCents: 1_000, status: 'GRANTED' },
      });

      expect(await service.canRedeem(campaign.id, userId)).toBe(false);
    });
  });

  describe('resolveEligibleForPlayer', () => {
    it('resolves the oldest enabled campaign the viewer is targeted by and has not redeemed', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);

      const resolved = await service.resolveEligibleForPlayer(brandAId, userId, ANONYMOUS_VIEWER);
      expect(resolved?.id).toBe(campaign.id);
    });

    it('skips a disabled campaign', async () => {
      await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      expect(await service.resolveEligibleForPlayer(brandAId, userId, ANONYMOUS_VIEWER)).toBeNull();
    });

    it('a SEGMENTS-mode campaign never matches a fresh signup with no segments yet', async () => {
      const segment = await prisma.playerSegment.create({ data: { brandId: brandAId, name: `Seg ${randomUUID()}` } });
      const campaign = await service.create(
        brandAId,
        { ...FIXED_INPUT, audienceMode: 'SEGMENTS', segmentIds: [segment.id] },
        TEST_ACTOR,
      );
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);

      expect(await service.resolveEligibleForPlayer(brandAId, userId, ANONYMOUS_VIEWER)).toBeNull();
      expect(
        await service.resolveEligibleForPlayer(brandAId, userId, { isLoggedIn: true, segmentIds: [segment.id] }),
      ).not.toBeNull();
    });

    it('skips a campaign this player has already redeemed', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      await prisma.registerCampaignRedemption.create({
        data: { registerCampaignId: campaign.id, userId, brandId: brandAId, rewardAmountCents: 1_000, status: 'GRANTED' },
      });

      expect(await service.resolveEligibleForPlayer(brandAId, userId, ANONYMOUS_VIEWER)).toBeNull();
    });
  });

  describe('resolvePendingBetRedemption', () => {
    async function createPendingRedemption(campaignId: string) {
      return prisma.registerCampaignRedemption.create({
        data: { registerCampaignId: campaignId, userId, brandId: brandAId, status: 'PENDING_BET' },
      });
    }

    it('resolves a pending redemption when the bet qualifies and is within the day window', async () => {
      const campaign = await service.create(
        brandAId,
        { name: 'Welcome Bonus', rewardAmountCents: 1_000, requiresBet: true, qualifyingBetWindowDays: 7, minStakeCents: 1_000 },
        TEST_ACTOR,
      );
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      await createPendingRedemption(campaign.id);

      const userCreatedAt = new Date();
      const resolved = await service.resolvePendingBetRedemption(userId, userCreatedAt, {
        stakeCents: 1_000,
        legOdds: [2.0],
      });
      expect(resolved?.registerCampaignId).toBe(campaign.id);
    });

    it('does not resolve once the qualifying bet window has passed', async () => {
      const campaign = await service.create(
        brandAId,
        { name: 'Welcome Bonus', rewardAmountCents: 1_000, requiresBet: true, qualifyingBetWindowDays: 3 },
        TEST_ACTOR,
      );
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      await createPendingRedemption(campaign.id);

      const userCreatedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const resolved = await service.resolvePendingBetRedemption(userId, userCreatedAt, {
        stakeCents: 1_000,
        legOdds: [2.0],
      });
      expect(resolved).toBeNull();
    });

    it('does not resolve when the bet does not meet the campaign conditions', async () => {
      const campaign = await service.create(
        brandAId,
        { name: 'Welcome Bonus', rewardAmountCents: 1_000, requiresBet: true, qualifyingBetWindowDays: 7, minStakeCents: 5_000 },
        TEST_ACTOR,
      );
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      await createPendingRedemption(campaign.id);

      const resolved = await service.resolvePendingBetRedemption(userId, new Date(), {
        stakeCents: 1_000,
        legOdds: [2.0],
      });
      expect(resolved).toBeNull();
    });
  });
});

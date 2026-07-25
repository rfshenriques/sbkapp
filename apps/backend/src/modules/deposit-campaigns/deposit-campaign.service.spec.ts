import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { ANONYMOUS_VIEWER } from '../audience/audience';
import { DepositCampaignService } from './deposit-campaign.service';

describe('DepositCampaignService', () => {
  let moduleRef: TestingModule;
  let service: DepositCampaignService;
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
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-deposit-campaign-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-deposit-campaign-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_deposit_campaign', brandId: brandAId };
  });

  afterAll(async () => {
    await setupPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [DepositCampaignService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(DepositCampaignService);
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
    await prisma.freebetGrant.deleteMany({ where: { userId } });
    await prisma.depositCampaignRedemption.deleteMany({ where: { userId } });
    await prisma.deposit.deleteMany({ where: { userId } });
    await prisma.depositCampaign.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await prisma.playerSegment.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  async function createRedemption(campaignId: string) {
    const deposit = await prisma.deposit.create({ data: { userId, brandId: brandAId, amountCents: 5_000 } });
    return prisma.depositCampaignRedemption.create({
      data: { depositCampaignId: campaignId, userId, brandId: brandAId, depositId: deposit.id, rewardAmountCents: 1_000 },
    });
  }

  const FIXED_INPUT = {
    name: 'Deposit Boost',
    minDepositAmountCents: 5_000,
    rewardType: 'FIXED' as const,
    fixedRewardAmountCents: 1_000,
  };

  it('creates a campaign and lists it back', async () => {
    await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);

    const listed = await service.list(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ name: 'Deposit Boost', minDepositAmountCents: 5_000, enabled: false });
  });

  it('rejects a FIXED campaign with no fixedRewardAmountCents', async () => {
    await expect(
      service.create(brandAId, { name: 'Bad', minDepositAmountCents: 1_000, rewardType: 'FIXED' }, TEST_ACTOR),
    ).rejects.toThrow('fixedRewardAmountCents is required');
  });

  it('rejects a PERCENTAGE campaign missing rewardPercent or rewardCapCents', async () => {
    await expect(
      service.create(
        brandAId,
        { name: 'Bad', minDepositAmountCents: 1_000, rewardType: 'PERCENTAGE', rewardPercent: 50 },
        TEST_ACTOR,
      ),
    ).rejects.toThrow('rewardPercent and rewardCapCents are required');
  });

  it('records an audit entry on create', async () => {
    const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({ where: { actorUsername: TEST_ACTOR.username } });
    expect(entries.map((entry) => entry.action)).toContain('DEPOSIT_CAMPAIGN_CREATED');
    expect(entries[0]?.targetId).toBe(campaign.id);
  });

  it('updates a campaign in place, re-validating the reward config against the merged result', async () => {
    const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);

    const updated = await service.update(brandAId, campaign.id, { name: 'Live', enabled: true }, TEST_ACTOR);
    expect(updated.name).toBe('Live');
    expect(updated.enabled).toBe(true);

    await expect(
      service.update(brandAId, campaign.id, { rewardType: 'PERCENTAGE' }, TEST_ACTOR),
    ).rejects.toThrow('rewardPercent and rewardCapCents are required');
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

  it('sets and replaces segments via segmentIds', async () => {
    const segmentA = await prisma.playerSegment.create({ data: { brandId: brandAId, name: `Seg A ${randomUUID()}` } });
    const segmentB = await prisma.playerSegment.create({ data: { brandId: brandAId, name: `Seg B ${randomUUID()}` } });

    const campaign = await service.create(
      brandAId,
      { ...FIXED_INPUT, audienceMode: 'SEGMENTS', segmentIds: [segmentA.id, segmentB.id] },
      TEST_ACTOR,
    );
    expect(campaign.segments).toHaveLength(2);

    const updated = await service.update(brandAId, campaign.id, { segmentIds: [segmentA.id] }, TEST_ACTOR);
    expect(updated.segments).toHaveLength(1);
    expect(updated.segments[0]?.segmentId).toBe(segmentA.id);
  });

  describe('canRedeem', () => {
    it('allows exactly one redemption when allowMultipleRedemptions is false', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);

      expect(await service.canRedeem(campaign, userId)).toBe(true);
      await createRedemption(campaign.id);
      expect(await service.canRedeem(campaign, userId)).toBe(false);
    });

    it('a still-pending redemption already consumes a slot, not just a granted one', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      const redemption = await createRedemption(campaign.id);
      expect(redemption.status).toBe('PENDING_BET');

      expect(await service.canRedeem(campaign, userId)).toBe(false);
    });

    it('allows up to maxRedemptionsPerPlayer when allowMultipleRedemptions is true', async () => {
      const campaign = await service.create(
        brandAId,
        { ...FIXED_INPUT, allowMultipleRedemptions: true, maxRedemptionsPerPlayer: 2 },
        TEST_ACTOR,
      );

      expect(await service.canRedeem(campaign, userId)).toBe(true);
      await createRedemption(campaign.id);
      expect(await service.canRedeem(campaign, userId)).toBe(true);
      await createRedemption(campaign.id);
      expect(await service.canRedeem(campaign, userId)).toBe(false);
    });

    it("a different campaign's redemptions never count against this one", async () => {
      const campaignA = await service.create(brandAId, { ...FIXED_INPUT, name: 'A' }, TEST_ACTOR);
      const campaignB = await service.create(brandAId, { ...FIXED_INPUT, name: 'B' }, TEST_ACTOR);

      await createRedemption(campaignA.id);

      expect(await service.canRedeem(campaignB, userId)).toBe(true);
    });
  });

  describe('hasBeenGranted', () => {
    it('is false while a redemption is only pending', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await createRedemption(campaign.id);

      expect(await service.hasBeenGranted(campaign.id, userId)).toBe(false);
    });

    it('is true once a DEPOSIT_CAMPAIGN freebet has actually been granted', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await prisma.freebetGrant.create({
        data: { userId, brandId: brandAId, amountCents: 1_000, source: 'DEPOSIT_CAMPAIGN', sourceCampaignId: campaign.id },
      });

      expect(await service.hasBeenGranted(campaign.id, userId)).toBe(true);
    });
  });

  describe('resolveEligibleForPlayer', () => {
    it('returns the first enabled campaign the viewer is in audience for and can still redeem', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);

      const resolved = await service.resolveEligibleForPlayer(brandAId, userId, { isLoggedIn: true, segmentIds: [] });
      expect(resolved?.id).toBe(campaign.id);
    });

    it('skips a disabled campaign', async () => {
      await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);

      const resolved = await service.resolveEligibleForPlayer(brandAId, userId, { isLoggedIn: true, segmentIds: [] });
      expect(resolved).toBeNull();
    });

    it('skips a campaign outside the viewer audience', async () => {
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

    it('skips a campaign the player has already exhausted their redemptions on', async () => {
      const campaign = await service.create(brandAId, FIXED_INPUT, TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
      await createRedemption(campaign.id);

      expect(await service.resolveEligibleForPlayer(brandAId, userId, { isLoggedIn: true, segmentIds: [] })).toBeNull();
    });
  });
});

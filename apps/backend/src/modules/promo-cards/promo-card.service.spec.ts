import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { ANONYMOUS_VIEWER, type AudienceViewer } from '../audience/audience';
import { BetAndGetCampaignService } from '../bet-and-get/bet-and-get-campaign.service';
import { DepositCampaignService } from '../deposit-campaigns/deposit-campaign.service';
import { FreebetService } from '../freebets/freebet.service';
import { LeaderboardCampaignService } from '../leaderboards/leaderboard-campaign.service';
import { RegisterCampaignService } from '../register-campaigns/register-campaign.service';
import { PromoCardService } from './promo-card.service';

describe('PromoCardService', () => {
  let moduleRef: TestingModule;
  let service: PromoCardService;
  let campaignService: BetAndGetCampaignService;
  let depositCampaignService: DepositCampaignService;
  let registerCampaignService: RegisterCampaignService;
  let leaderboardCampaignService: LeaderboardCampaignService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;
  let OTHER_BRAND_ACTOR: AuditActor;

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-promo-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-promo-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_promo_card', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_promo_card_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PromoCardService,
        BetAndGetCampaignService,
        DepositCampaignService,
        RegisterCampaignService,
        LeaderboardCampaignService,
        FreebetService,
        PrismaService,
        AuditLogService,
      ],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(PromoCardService);
    campaignService = moduleRef.get(BetAndGetCampaignService);
    depositCampaignService = moduleRef.get(DepositCampaignService);
    registerCampaignService = moduleRef.get(RegisterCampaignService);
    leaderboardCampaignService = moduleRef.get(LeaderboardCampaignService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.promoCard.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await prisma.betAndGetCampaign.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await prisma.depositCampaign.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await prisma.registerCampaign.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await prisma.leaderboardCampaign.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('adds cards in order and lists them back by sortOrder, without raw bytes', async () => {
    await service.add(brandAId, Buffer.from('one'), 'image/png', {}, TEST_ACTOR);
    await service.add(brandAId, Buffer.from('two'), 'image/png', {}, TEST_ACTOR);

    const cards = await service.list(brandAId);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.sortOrder).toBe(0);
    expect(cards[1]?.sortOrder).toBe(1);
    expect(cards[0]).not.toHaveProperty('data');
  });

  it('stores title, subtitle, and a campaign link', async () => {
    const campaign = await campaignService.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);

    const card = await service.add(
      brandAId,
      Buffer.from('bytes'),
      'image/png',
      { title: 'Champions League', subtitle: 'Bet & get €10', betAndGetCampaignId: campaign.id },
      TEST_ACTOR,
    );

    expect(card).toMatchObject({
      title: 'Champions League',
      subtitle: 'Bet & get €10',
      betAndGetCampaignId: campaign.id,
    });
  });

  it('rejects linking a card to a nonexistent campaign', async () => {
    await expect(
      service.add(brandAId, Buffer.from('bytes'), 'image/png', { betAndGetCampaignId: 'does-not-exist' }, TEST_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects linking a card to another brand's campaign, even by guessing its id", async () => {
    const otherBrandCampaign = await campaignService.create(
      brandBId,
      { name: 'Other Brand Campaign', rewardAmountCents: 1_000 },
      OTHER_BRAND_ACTOR,
    );

    await expect(
      service.add(
        brandAId,
        Buffer.from('bytes'),
        'image/png',
        { betAndGetCampaignId: otherBrandCampaign.id },
        TEST_ACTOR,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a card with no campaign link is purely decorative (betAndGetCampaignId stays null)', async () => {
    const card = await service.add(brandAId, Buffer.from('bytes'), 'image/png', { title: 'Welcome' }, TEST_ACTOR);

    expect(card.betAndGetCampaignId).toBeNull();
  });

  it('getItemData returns the raw bytes for serving', async () => {
    const card = await service.add(brandAId, Buffer.from('bytes'), 'image/png', {}, TEST_ACTOR);

    const fetched = await service.getItemData(brandAId, card.id);
    expect(Buffer.from(fetched!.data!).toString()).toBe('bytes');
  });

  it('updates title/subtitle/campaign link without touching the image', async () => {
    const campaign = await campaignService.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);
    const card = await service.add(brandAId, Buffer.from('bytes'), 'image/png', { title: 'Draft' }, TEST_ACTOR);

    const updated = await service.update(
      brandAId,
      card.id,
      { title: 'Live', betAndGetCampaignId: campaign.id },
      TEST_ACTOR,
    );

    expect(updated).toMatchObject({ title: 'Live', betAndGetCampaignId: campaign.id });
    const fetched = await service.getItemData(brandAId, card.id);
    expect(Buffer.from(fetched!.data!).toString()).toBe('bytes');
  });

  it('updating with betAndGetCampaignId: null unlinks the card from its campaign', async () => {
    const campaign = await campaignService.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);
    const card = await service.add(
      brandAId,
      Buffer.from('bytes'),
      'image/png',
      { betAndGetCampaignId: campaign.id },
      TEST_ACTOR,
    );

    const updated = await service.update(brandAId, card.id, { betAndGetCampaignId: null }, TEST_ACTOR);

    expect(updated.betAndGetCampaignId).toBeNull();
  });

  it("a brand can never update another brand's card, even by guessing its id", async () => {
    const card = await service.add(brandAId, Buffer.from('bytes'), 'image/png', {}, TEST_ACTOR);

    await expect(
      service.update(brandBId, card.id, { title: 'Hijacked' }, OTHER_BRAND_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateImage gives an auto-created (imageless) card its first image', async () => {
    const autoCard = await prisma.promoCard.create({
      data: { brandId: brandAId, data: null, mimeType: null, title: 'Auto', autoCreated: true, sortOrder: 0 },
    });
    expect((await service.list(brandAId))[0]?.mimeType).toBeNull();

    const updated = await service.updateImage(brandAId, autoCard.id, Buffer.from('artwork'), 'image/png', TEST_ACTOR);

    expect(updated.mimeType).toBe('image/png');
    expect(updated.title).toBe('Auto');
    const fetched = await service.getItemData(brandAId, autoCard.id);
    expect(Buffer.from(fetched!.data!).toString()).toBe('artwork');
  });

  it('updateImage replaces an existing image without touching title/subtitle/campaign link', async () => {
    const campaign = await campaignService.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);
    const card = await service.add(
      brandAId,
      Buffer.from('old'),
      'image/png',
      { title: 'Keep me', betAndGetCampaignId: campaign.id },
      TEST_ACTOR,
    );

    const updated = await service.updateImage(brandAId, card.id, Buffer.from('new'), 'image/webp', TEST_ACTOR);

    expect(updated).toMatchObject({ mimeType: 'image/webp', title: 'Keep me', betAndGetCampaignId: campaign.id });
    const fetched = await service.getItemData(brandAId, card.id);
    expect(Buffer.from(fetched!.data!).toString()).toBe('new');
  });

  it("a brand can never set another brand's card image, even by guessing its id", async () => {
    const card = await service.add(brandAId, Buffer.from('bytes'), 'image/png', {}, TEST_ACTOR);

    await expect(
      service.updateImage(brandBId, card.id, Buffer.from('hijacked'), 'image/png', OTHER_BRAND_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removing a card deletes it', async () => {
    const card = await service.add(brandAId, Buffer.from('bytes'), 'image/png', {}, TEST_ACTOR);
    await service.remove(brandAId, card.id, TEST_ACTOR);

    expect(await service.list(brandAId)).toEqual([]);
  });

  it('removing a nonexistent card throws NotFoundException', async () => {
    await expect(service.remove(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reorders cards to match the given id order', async () => {
    const first = await service.add(brandAId, Buffer.from('a'), 'image/png', {}, TEST_ACTOR);
    const second = await service.add(brandAId, Buffer.from('b'), 'image/png', {}, TEST_ACTOR);
    const third = await service.add(brandAId, Buffer.from('c'), 'image/png', {}, TEST_ACTOR);

    const reordered = await service.reorder(brandAId, [third.id, first.id, second.id], TEST_ACTOR);

    expect(reordered.map((card) => card.id)).toEqual([third.id, first.id, second.id]);
  });

  it('rejects a reorder that omits or adds cards', async () => {
    const first = await service.add(brandAId, Buffer.from('a'), 'image/png', {}, TEST_ACTOR);
    await service.add(brandAId, Buffer.from('b'), 'image/png', {}, TEST_ACTOR);

    await expect(service.reorder(brandAId, [first.id], TEST_ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records audit entries for add, update, reorder, and remove', async () => {
    const card = await service.add(brandAId, Buffer.from('a'), 'image/png', {}, TEST_ACTOR);
    await service.update(brandAId, card.id, { title: 'Live' }, TEST_ACTOR);
    await service.reorder(brandAId, [card.id], TEST_ACTOR);
    await service.remove(brandAId, card.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'PROMO_CARD_ADDED',
      'PROMO_CARD_UPDATED',
      'PROMO_CARD_REORDERED',
      'PROMO_CARD_REMOVED',
    ]);
  });

  it('is isolated per brand: cards in one brand do not appear in another', async () => {
    await service.add(brandAId, Buffer.from('a'), 'image/png', {}, TEST_ACTOR);

    expect(await service.list(brandAId)).toHaveLength(1);
    expect(await service.list(brandBId)).toHaveLength(0);
  });

  describe('deposit campaign linking', () => {
    it('stores a deposit campaign link', async () => {
      const campaign = await depositCampaignService.create(
        brandAId,
        { name: 'Deposit Boost', minDepositAmountCents: 5_000, rewardType: 'FIXED', fixedRewardAmountCents: 1_000 },
        TEST_ACTOR,
      );

      const card = await service.add(
        brandAId,
        Buffer.from('bytes'),
        'image/png',
        { depositCampaignId: campaign.id },
        TEST_ACTOR,
      );

      expect(card.depositCampaignId).toBe(campaign.id);
    });

    it('rejects linking a card to a nonexistent deposit campaign', async () => {
      await expect(
        service.add(brandAId, Buffer.from('bytes'), 'image/png', { depositCampaignId: 'does-not-exist' }, TEST_ACTOR),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects linking a card to another brand's deposit campaign, even by guessing its id", async () => {
      const otherBrandCampaign = await depositCampaignService.create(
        brandBId,
        { name: 'Other', minDepositAmountCents: 5_000, rewardType: 'FIXED', fixedRewardAmountCents: 1_000 },
        OTHER_BRAND_ACTOR,
      );

      await expect(
        service.add(
          brandAId,
          Buffer.from('bytes'),
          'image/png',
          { depositCampaignId: otherBrandCampaign.id },
          TEST_ACTOR,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a card linked to both a Bet & Get and a Deposit campaign at once', async () => {
      const betAndGet = await campaignService.create(brandAId, { name: 'BNG', rewardAmountCents: 1_000 }, TEST_ACTOR);
      const deposit = await depositCampaignService.create(
        brandAId,
        { name: 'Deposit', minDepositAmountCents: 5_000, rewardType: 'FIXED', fixedRewardAmountCents: 1_000 },
        TEST_ACTOR,
      );

      await expect(
        service.add(
          brandAId,
          Buffer.from('bytes'),
          'image/png',
          { betAndGetCampaignId: betAndGet.id, depositCampaignId: deposit.id },
          TEST_ACTOR,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an update that would leave both campaign links set, even when only one field is touched', async () => {
      const betAndGet = await campaignService.create(brandAId, { name: 'BNG', rewardAmountCents: 1_000 }, TEST_ACTOR);
      const deposit = await depositCampaignService.create(
        brandAId,
        { name: 'Deposit', minDepositAmountCents: 5_000, rewardType: 'FIXED', fixedRewardAmountCents: 1_000 },
        TEST_ACTOR,
      );
      const card = await service.add(
        brandAId,
        Buffer.from('bytes'),
        'image/png',
        { betAndGetCampaignId: betAndGet.id },
        TEST_ACTOR,
      );

      await expect(
        service.update(brandAId, card.id, { depositCampaignId: deposit.id }, TEST_ACTOR),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('register and leaderboard campaign linking', () => {
    it('stores a register campaign link', async () => {
      const campaign = await registerCampaignService.create(
        brandAId,
        { name: 'Welcome Bonus', rewardAmountCents: 1_000 },
        TEST_ACTOR,
      );

      const card = await service.add(
        brandAId,
        Buffer.from('bytes'),
        'image/png',
        { registerCampaignId: campaign.id },
        TEST_ACTOR,
      );

      expect(card.registerCampaignId).toBe(campaign.id);
    });

    it('rejects linking a card to a nonexistent register campaign', async () => {
      await expect(
        service.add(brandAId, Buffer.from('bytes'), 'image/png', { registerCampaignId: 'does-not-exist' }, TEST_ACTOR),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects linking a card to another brand's register campaign, even by guessing its id", async () => {
      const otherBrandCampaign = await registerCampaignService.create(
        brandBId,
        { name: 'Other', rewardAmountCents: 1_000 },
        OTHER_BRAND_ACTOR,
      );

      await expect(
        service.add(
          brandAId,
          Buffer.from('bytes'),
          'image/png',
          { registerCampaignId: otherBrandCampaign.id },
          TEST_ACTOR,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('stores a leaderboard campaign link', async () => {
      const campaign = await leaderboardCampaignService.create(
        brandAId,
        { name: 'Weekly Leaderboard', endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        TEST_ACTOR,
      );

      const card = await service.add(
        brandAId,
        Buffer.from('bytes'),
        'image/png',
        { leaderboardCampaignId: campaign.id },
        TEST_ACTOR,
      );

      expect(card.leaderboardCampaignId).toBe(campaign.id);
    });

    it('rejects linking a card to a nonexistent leaderboard campaign', async () => {
      await expect(
        service.add(
          brandAId,
          Buffer.from('bytes'),
          'image/png',
          { leaderboardCampaignId: 'does-not-exist' },
          TEST_ACTOR,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a card linked to a Register and a Leaderboard campaign at once', async () => {
      const register = await registerCampaignService.create(
        brandAId,
        { name: 'Welcome Bonus', rewardAmountCents: 1_000 },
        TEST_ACTOR,
      );
      const leaderboard = await leaderboardCampaignService.create(
        brandAId,
        { name: 'Weekly Leaderboard', endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        TEST_ACTOR,
      );

      await expect(
        service.add(
          brandAId,
          Buffer.from('bytes'),
          'image/png',
          { registerCampaignId: register.id, leaderboardCampaignId: leaderboard.id },
          TEST_ACTOR,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('listForViewer', () => {
    let userId: string;
    let userViewer: AudienceViewer;
    const createdUserIds: string[] = [];

    /** create() always makes a disabled campaign (schema default) - only update() can flip enabled, so these go through both to get a live one for listForViewer to see. */
    async function createEnabledBetAndGetCampaign(input: Parameters<BetAndGetCampaignService['create']>[1]) {
      const campaign = await campaignService.create(brandAId, input, TEST_ACTOR);
      return campaignService.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
    }

    async function createEnabledDepositCampaign(input: Parameters<DepositCampaignService['create']>[1]) {
      const campaign = await depositCampaignService.create(brandAId, input, TEST_ACTOR);
      return depositCampaignService.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);
    }

    beforeEach(async () => {
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
      userViewer = { isLoggedIn: true, segmentIds: [] };
      createdUserIds.push(user.id);
    });

    afterEach(async () => {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    });

    it('shows every card to a logged-out viewer, unfiltered', async () => {
      const campaign = await createEnabledBetAndGetCampaign({ name: 'BNG', rewardAmountCents: 1_000 });
      await service.add(brandAId, Buffer.from('a'), 'image/png', { betAndGetCampaignId: campaign.id }, TEST_ACTOR);

      expect(await service.listForViewer(brandAId, ANONYMOUS_VIEWER, null)).toHaveLength(1);
    });

    it('hides a card linked to a Bet & Get campaign the player already redeemed', async () => {
      const campaign = await createEnabledBetAndGetCampaign({ name: 'BNG', rewardAmountCents: 1_000 });
      await service.add(brandAId, Buffer.from('a'), 'image/png', { betAndGetCampaignId: campaign.id }, TEST_ACTOR);
      await prisma.freebetGrant.create({
        data: { userId, brandId: brandAId, amountCents: 1_000, remainingCents: 1_000, source: 'BET_AND_GET', sourceCampaignId: campaign.id },
      });

      expect(await service.listForViewer(brandAId, userViewer, userId)).toEqual([]);
    });

    it('hides a card linked to a Deposit campaign the player already redeemed', async () => {
      const campaign = await createEnabledDepositCampaign({
        name: 'Deposit',
        minDepositAmountCents: 5_000,
        rewardType: 'FIXED',
        fixedRewardAmountCents: 1_000,
      });
      await service.add(brandAId, Buffer.from('a'), 'image/png', { depositCampaignId: campaign.id }, TEST_ACTOR);
      const deposit = await prisma.deposit.create({ data: { userId, brandId: brandAId, amountCents: 5_000 } });
      await prisma.depositCampaignRedemption.create({
        data: {
          depositCampaignId: campaign.id,
          userId,
          brandId: brandAId,
          depositId: deposit.id,
          rewardAmountCents: 1_000,
          status: 'GRANTED',
        },
      });

      expect(await service.listForViewer(brandAId, userViewer, userId)).toEqual([]);
    });

    it('still shows a card whose campaign allows multiple redemptions, up to the cap', async () => {
      const campaign = await createEnabledBetAndGetCampaign({
        name: 'BNG',
        rewardAmountCents: 1_000,
        allowMultipleRedemptions: true,
        maxRedemptionsPerPlayer: 2,
      });
      await service.add(brandAId, Buffer.from('a'), 'image/png', { betAndGetCampaignId: campaign.id }, TEST_ACTOR);
      await prisma.freebetGrant.create({
        data: { userId, brandId: brandAId, amountCents: 1_000, remainingCents: 1_000, source: 'BET_AND_GET', sourceCampaignId: campaign.id },
      });

      expect(await service.listForViewer(brandAId, userViewer, userId)).toHaveLength(1);
    });

    it('still shows a decorative card (no campaign link) regardless of the viewer', async () => {
      await service.add(brandAId, Buffer.from('a'), 'image/png', {}, TEST_ACTOR);

      expect(await service.listForViewer(brandAId, userViewer, userId)).toHaveLength(1);
    });

    it('hides a card whose campaign is disabled', async () => {
      const campaign = await campaignService.create(brandAId, { name: 'BNG', rewardAmountCents: 1_000 }, TEST_ACTOR);
      await service.add(brandAId, Buffer.from('a'), 'image/png', { betAndGetCampaignId: campaign.id }, TEST_ACTOR);

      expect(await service.listForViewer(brandAId, ANONYMOUS_VIEWER, null)).toEqual([]);
    });

    it('shows an early-ended card with EARLY_ENDED status rather than hiding it', async () => {
      const campaign = await createEnabledBetAndGetCampaign({
        name: 'BNG',
        rewardAmountCents: 1_000,
        endAt: new Date(Date.now() - 60_000),
      });
      await service.add(brandAId, Buffer.from('a'), 'image/png', { betAndGetCampaignId: campaign.id }, TEST_ACTOR);

      const cards = await service.listForViewer(brandAId, ANONYMOUS_VIEWER, null);
      expect(cards).toHaveLength(1);
      expect(cards[0]?.status).toBe('EARLY_ENDED');
    });
  });
});

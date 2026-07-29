import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { ANONYMOUS_VIEWER } from '../audience/audience';
import { BetAndGetCampaignService } from './bet-and-get-campaign.service';

describe('BetAndGetCampaignService', () => {
  let moduleRef: TestingModule;
  let service: BetAndGetCampaignService;
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
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-bng-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-bng-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_bng', brandId: brandAId };
  });

  afterAll(async () => {
    await setupPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [BetAndGetCampaignService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(BetAndGetCampaignService);
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
    await prisma.betAndGetCampaign.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('creates a campaign and lists it back', async () => {
    await service.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);

    const listed = await service.list(brandAId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ name: 'CL Bet & Get', rewardAmountCents: 1_000, enabled: false });
  });

  it('creates a PERCENTAGE-reward campaign', async () => {
    await service.create(
      brandAId,
      { name: 'CL Bet & Get', rewardType: 'PERCENTAGE', rewardPercent: 10, rewardCapCents: 2_000 },
      TEST_ACTOR,
    );

    const listed = await service.list(brandAId);
    expect(listed[0]).toMatchObject({ rewardType: 'PERCENTAGE', rewardPercent: 10, rewardCapCents: 2_000, rewardAmountCents: null });
  });

  it('rejects a FIXED campaign missing rewardAmountCents', async () => {
    await expect(service.create(brandAId, { name: 'CL Bet & Get', rewardType: 'FIXED' }, TEST_ACTOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a PERCENTAGE campaign missing rewardPercent or rewardCapCents', async () => {
    await expect(
      service.create(brandAId, { name: 'CL Bet & Get', rewardType: 'PERCENTAGE', rewardPercent: 10 }, TEST_ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(brandAId, { name: 'CL Bet & Get', rewardType: 'PERCENTAGE', rewardCapCents: 2_000 }, TEST_ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects switching an existing FIXED campaign to PERCENTAGE without the new fields', async () => {
    const campaign = await service.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);

    await expect(
      service.update(brandAId, campaign.id, { rewardType: 'PERCENTAGE' }, TEST_ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records an audit entry on create', async () => {
    const campaign = await service.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({ where: { actorUsername: TEST_ACTOR.username } });
    expect(entries.map((entry) => entry.action)).toContain('BET_AND_GET_CAMPAIGN_CREATED');
    expect(entries[0]?.targetId).toBe(campaign.id);
  });

  it('updates a campaign in place', async () => {
    const campaign = await service.create(brandAId, { name: 'Draft', rewardAmountCents: 500 }, TEST_ACTOR);

    const updated = await service.update(brandAId, campaign.id, { name: 'Live', enabled: true }, TEST_ACTOR);

    expect(updated.name).toBe('Live');
    expect(updated.enabled).toBe(true);
  });

  it("a brand can never update another brand's campaign, even by guessing its id", async () => {
    const campaign = await service.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);

    await expect(service.update(brandBId, campaign.id, { name: 'Hijacked' }, TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removes a campaign', async () => {
    const campaign = await service.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);
    await service.remove(brandAId, campaign.id, TEST_ACTOR);

    expect(await service.list(brandAId)).toEqual([]);
  });

  it('sets and replaces a campaign scope', async () => {
    const campaign = await service.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);

    await service.setScopes(
      brandAId,
      campaign.id,
      [
        { scopeType: 'COMPETITION', scopeValue: 'Champions League' },
        { scopeType: 'SPORT', scopeValue: 'Basketball' },
      ],
      TEST_ACTOR,
    );
    let fetched = await service.get(brandAId, campaign.id);
    expect(fetched.scopes).toHaveLength(2);

    await service.setScopes(brandAId, campaign.id, [{ scopeType: 'MATCH', scopeValue: 'match-1' }], TEST_ACTOR);
    fetched = await service.get(brandAId, campaign.id);
    expect(fetched.scopes).toHaveLength(1);
    expect(fetched.scopes[0]).toMatchObject({ scopeType: 'MATCH', scopeValue: 'match-1' });
  });

  describe('findActiveForMatch', () => {
    it('returns only enabled campaigns whose scope covers the match', async () => {
      const inScope = await service.create(brandAId, { name: 'In scope', rewardAmountCents: 1_000 }, TEST_ACTOR);
      await service.setScopes(brandAId, inScope.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);
      await service.update(brandAId, inScope.id, { enabled: true }, TEST_ACTOR);

      const disabled = await service.create(brandAId, { name: 'Disabled', rewardAmountCents: 1_000 }, TEST_ACTOR);
      await service.setScopes(brandAId, disabled.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);

      const outOfScope = await service.create(brandAId, { name: 'Out of scope', rewardAmountCents: 1_000 }, TEST_ACTOR);
      await service.setScopes(brandAId, outOfScope.id, [{ scopeType: 'SPORT', scopeValue: 'Basketball' }], TEST_ACTOR);
      await service.update(brandAId, outOfScope.id, { enabled: true }, TEST_ACTOR);

      const match = { sport: 'Football', competition: 'EPL', matchId: 'match-1', isLive: false };
      const active = await service.findActiveForMatch(brandAId, match, ANONYMOUS_VIEWER);

      expect(active.map((campaign) => campaign.id)).toEqual([inScope.id]);
    });

    it('excludes an enabled campaign outside its scheduling window, includes one inside it', async () => {
      const notYetStarted = await service.create(
        brandAId,
        { name: 'Future', rewardAmountCents: 1_000, startAt: new Date(Date.now() + 86_400_000) },
        TEST_ACTOR,
      );
      await service.setScopes(brandAId, notYetStarted.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);
      await service.update(brandAId, notYetStarted.id, { enabled: true }, TEST_ACTOR);

      const alreadyEnded = await service.create(
        brandAId,
        { name: 'Past', rewardAmountCents: 1_000, endAt: new Date(Date.now() - 86_400_000) },
        TEST_ACTOR,
      );
      await service.setScopes(brandAId, alreadyEnded.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);
      await service.update(brandAId, alreadyEnded.id, { enabled: true }, TEST_ACTOR);

      const currentlyRunning = await service.create(
        brandAId,
        {
          name: 'Now',
          rewardAmountCents: 1_000,
          startAt: new Date(Date.now() - 86_400_000),
          endAt: new Date(Date.now() + 86_400_000),
        },
        TEST_ACTOR,
      );
      await service.setScopes(brandAId, currentlyRunning.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);
      await service.update(brandAId, currentlyRunning.id, { enabled: true }, TEST_ACTOR);

      const match = { sport: 'Football', competition: 'EPL', matchId: 'match-1', isLive: false };
      const active = await service.findActiveForMatch(brandAId, match, ANONYMOUS_VIEWER);

      expect(active.map((campaign) => campaign.id)).toEqual([currentlyRunning.id]);
    });

    it('flags timingBlocked when the campaign is in scope but its bettingTiming rejects this match\'s live status', async () => {
      const prematchOnly = await service.create(
        brandAId,
        { name: 'Prematch only', rewardAmountCents: 1_000, bettingTiming: 'PREMATCH_ONLY' },
        TEST_ACTOR,
      );
      await service.setScopes(brandAId, prematchOnly.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);
      await service.update(brandAId, prematchOnly.id, { enabled: true }, TEST_ACTOR);

      const prematchMatch = { sport: 'Football', competition: 'EPL', matchId: 'match-1', isLive: false };
      const liveMatch = { sport: 'Football', competition: 'EPL', matchId: 'match-1', isLive: true };

      const [notBlocked] = await service.findActiveForMatch(brandAId, prematchMatch, ANONYMOUS_VIEWER);
      expect(notBlocked?.timingBlocked).toBe(false);

      const [blocked] = await service.findActiveForMatch(brandAId, liveMatch, ANONYMOUS_VIEWER);
      expect(blocked?.timingBlocked).toBe(true);
    });

    it('excludes a SEGMENTS-targeted campaign for a viewer outside the segment, includes it for one inside', async () => {
      const segment = await prisma.playerSegment.create({ data: { brandId: brandAId, name: `Seg ${randomUUID()}` } });
      const targeted = await service.create(
        brandAId,
        { name: 'VIP only', rewardAmountCents: 1_000, audienceMode: 'SEGMENTS', segmentIds: [segment.id] },
        TEST_ACTOR,
      );
      await service.setScopes(brandAId, targeted.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);
      await service.update(brandAId, targeted.id, { enabled: true }, TEST_ACTOR);

      const match = { sport: 'Football', competition: 'EPL', matchId: 'match-1', isLive: false };

      expect(await service.findActiveForMatch(brandAId, match, ANONYMOUS_VIEWER)).toEqual([]);
      expect(
        await service.findActiveForMatch(brandAId, match, { isLoggedIn: true, segmentIds: [] }),
      ).toEqual([]);

      const active = await service.findActiveForMatch(brandAId, match, { isLoggedIn: true, segmentIds: [segment.id] });
      expect(active.map((campaign) => campaign.id)).toEqual([targeted.id]);
    });
  });

  describe('resolveApplicableCampaign', () => {
    it('resolves a campaign only when every selection is in scope and conditions pass', async () => {
      const campaign = await service.create(
        brandAId,
        { name: 'CL Bet & Get', rewardAmountCents: 1_000, minStakeCents: 1_000 },
        TEST_ACTOR,
      );
      await service.setScopes(brandAId, campaign.id, [{ scopeType: 'COMPETITION', scopeValue: 'Champions League' }], TEST_ACTOR);
      await service.update(brandAId, campaign.id, { enabled: true }, TEST_ACTOR);

      const inScopeMatch = { sport: 'Football', competition: 'Champions League', matchId: 'match-1', isLive: false };
      const outOfScopeMatch = { sport: 'Football', competition: 'Premier League', matchId: 'match-2', isLive: false };

      const resolved = await service.resolveApplicableCampaign(
        brandAId,
        [inScopeMatch],
        { stakeCents: 1_000, legOdds: [2.0] },
        ANONYMOUS_VIEWER,
      );
      expect(resolved?.id).toBe(campaign.id);

      const rejectedByStake = await service.resolveApplicableCampaign(
        brandAId,
        [inScopeMatch],
        { stakeCents: 500, legOdds: [2.0] },
        ANONYMOUS_VIEWER,
      );
      expect(rejectedByStake).toBeNull();

      const rejectedBySecondLegOutOfScope = await service.resolveApplicableCampaign(
        brandAId,
        [inScopeMatch, outOfScopeMatch],
        { stakeCents: 1_000, legOdds: [2.0, 2.0] },
        ANONYMOUS_VIEWER,
      );
      expect(rejectedBySecondLegOutOfScope).toBeNull();
    });

    it('rejects a bet on a live match against a PREMATCH_ONLY campaign, and vice versa for INPLAY_ONLY', async () => {
      const prematchOnly = await service.create(
        brandAId,
        { name: 'Prematch only', rewardAmountCents: 1_000, bettingTiming: 'PREMATCH_ONLY' },
        TEST_ACTOR,
      );
      await service.setScopes(brandAId, prematchOnly.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);
      await service.update(brandAId, prematchOnly.id, { enabled: true }, TEST_ACTOR);

      const prematchMatch = { sport: 'Football', competition: 'EPL', matchId: 'match-1', isLive: false };
      const liveMatch = { sport: 'Football', competition: 'EPL', matchId: 'match-1', isLive: true };

      const resolvedPrematch = await service.resolveApplicableCampaign(
        brandAId,
        [prematchMatch],
        { stakeCents: 1_000, legOdds: [2.0] },
        ANONYMOUS_VIEWER,
      );
      expect(resolvedPrematch?.id).toBe(prematchOnly.id);

      const resolvedLive = await service.resolveApplicableCampaign(
        brandAId,
        [liveMatch],
        { stakeCents: 1_000, legOdds: [2.0] },
        ANONYMOUS_VIEWER,
      );
      expect(resolvedLive).toBeNull();
    });

    it('never resolves a disabled campaign', async () => {
      const campaign = await service.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);
      await service.setScopes(brandAId, campaign.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);

      const resolved = await service.resolveApplicableCampaign(
        brandAId,
        [{ sport: 'Football', competition: 'EPL', matchId: 'match-1', isLive: false }],
        { stakeCents: 1_000, legOdds: [2.0] },
        ANONYMOUS_VIEWER,
      );
      expect(resolved).toBeNull();
    });

    it('excludes a SEGMENTS-targeted campaign for a viewer outside the segment, includes it for one inside', async () => {
      const segment = await prisma.playerSegment.create({ data: { brandId: brandAId, name: `Seg ${randomUUID()}` } });
      const targeted = await service.create(
        brandAId,
        { name: 'VIP only', rewardAmountCents: 1_000, audienceMode: 'SEGMENTS', segmentIds: [segment.id] },
        TEST_ACTOR,
      );
      await service.setScopes(brandAId, targeted.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);
      await service.update(brandAId, targeted.id, { enabled: true }, TEST_ACTOR);

      const match = { sport: 'Football', competition: 'EPL', matchId: 'match-1', isLive: false };
      const bet = { stakeCents: 1_000, legOdds: [2.0] };

      expect(await service.resolveApplicableCampaign(brandAId, [match], bet, ANONYMOUS_VIEWER)).toBeNull();
      expect(
        await service.resolveApplicableCampaign(brandAId, [match], bet, { isLoggedIn: true, segmentIds: [] }),
      ).toBeNull();

      const resolved = await service.resolveApplicableCampaign(brandAId, [match], bet, {
        isLoggedIn: true,
        segmentIds: [segment.id],
      });
      expect(resolved?.id).toBe(targeted.id);
    });
  });

  describe('canRedeem', () => {
    it('allows exactly one redemption when allowMultipleRedemptions is false', async () => {
      const campaign = await service.create(brandAId, { name: 'CL Bet & Get', rewardAmountCents: 1_000 }, TEST_ACTOR);

      expect(await service.canRedeem(campaign, userId)).toBe(true);

      await prisma.freebetGrant.create({
        data: { userId, brandId: brandAId, amountCents: 1_000, remainingCents: 1_000, source: 'BET_AND_GET', sourceCampaignId: campaign.id },
      });

      expect(await service.canRedeem(campaign, userId)).toBe(false);
    });

    it('allows up to maxRedemptionsPerPlayer when allowMultipleRedemptions is true', async () => {
      const campaign = await service.create(
        brandAId,
        { name: 'CL Bet & Get', rewardAmountCents: 1_000, allowMultipleRedemptions: true, maxRedemptionsPerPlayer: 2 },
        TEST_ACTOR,
      );

      expect(await service.canRedeem(campaign, userId)).toBe(true);
      await prisma.freebetGrant.create({
        data: { userId, brandId: brandAId, amountCents: 1_000, remainingCents: 1_000, source: 'BET_AND_GET', sourceCampaignId: campaign.id },
      });
      expect(await service.canRedeem(campaign, userId)).toBe(true);
      await prisma.freebetGrant.create({
        data: { userId, brandId: brandAId, amountCents: 1_000, remainingCents: 1_000, source: 'BET_AND_GET', sourceCampaignId: campaign.id },
      });
      expect(await service.canRedeem(campaign, userId)).toBe(false);
    });

    it('is unlimited when allowMultipleRedemptions is true and maxRedemptionsPerPlayer is null', async () => {
      const campaign = await service.create(
        brandAId,
        { name: 'CL Bet & Get', rewardAmountCents: 1_000, allowMultipleRedemptions: true },
        TEST_ACTOR,
      );

      for (let i = 0; i < 5; i += 1) {
        await prisma.freebetGrant.create({
          data: { userId, brandId: brandAId, amountCents: 1_000, remainingCents: 1_000, source: 'BET_AND_GET', sourceCampaignId: campaign.id },
        });
      }
      expect(await service.canRedeem(campaign, userId)).toBe(true);
    });

    it('a different campaign\'s redemptions never count against this one', async () => {
      const campaignA = await service.create(brandAId, { name: 'A', rewardAmountCents: 1_000 }, TEST_ACTOR);
      const campaignB = await service.create(brandAId, { name: 'B', rewardAmountCents: 1_000 }, TEST_ACTOR);

      await prisma.freebetGrant.create({
        data: { userId, brandId: brandAId, amountCents: 1_000, remainingCents: 1_000, source: 'BET_AND_GET', sourceCampaignId: campaignA.id },
      });

      expect(await service.canRedeem(campaignB, userId)).toBe(true);
    });
  });
});

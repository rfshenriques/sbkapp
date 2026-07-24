import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Match } from '@sportsbook/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ANONYMOUS_VIEWER } from '../audience/audience';
import { PricedMatchesService } from '../margins/priced-matches.service';
import { ViewerResolverService } from '../margins/viewer-resolver.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { BetAndGetCampaignService } from './bet-and-get-campaign.service';
import { BetAndGetPublicController } from './bet-and-get-public.controller';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    sport: 'Football',
    country: 'England',
    competition: 'Champions League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: '2026-07-18T15:00:00Z',
    isLive: false,
    markets: [],
    ...overrides,
  };
}

describe('BetAndGetPublicController', () => {
  let moduleRef: TestingModule;
  let controller: BetAndGetPublicController;
  let campaignService: BetAndGetCampaignService;
  let prisma: PrismaService;
  let pricedMatchesService: { listForBrand: ReturnType<typeof vi.fn>; getForBrand: ReturnType<typeof vi.fn> };
  let brandId: string;
  let TEST_ACTOR: AuditActor;

  beforeAll(async () => {
    const setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Public BNG Brand ${unique}`, slug: `public-bng-brand-${unique}` },
    });
    brandId = brand.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_public_bng', brandId };
    await setupPrisma.$disconnect();
  });

  afterAll(async () => {
    const cleanupPrisma = new PrismaService();
    await cleanupPrisma.brand.delete({ where: { id: brandId } });
    await cleanupPrisma.$disconnect();
  });

  beforeEach(async () => {
    pricedMatchesService = {
      listForBrand: vi.fn().mockResolvedValue([]),
      getForBrand: vi.fn(),
    };

    moduleRef = await Test.createTestingModule({
      controllers: [BetAndGetPublicController],
      providers: [
        BetAndGetCampaignService,
        PrismaService,
        AuditLogService,
        { provide: PricedMatchesService, useValue: pricedMatchesService },
        { provide: ViewerResolverService, useValue: { resolve: vi.fn().mockResolvedValue(ANONYMOUS_VIEWER) } },
      ],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(BetAndGetPublicController);
    campaignService = moduleRef.get(BetAndGetCampaignService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.betAndGetCampaign.deleteMany({ where: { brandId } });
    await moduleRef.close();
  });

  it('lists only enabled campaigns', async () => {
    const enabled = await campaignService.create(brandId, { name: 'Live', rewardAmountCents: 500 }, TEST_ACTOR);
    await campaignService.update(brandId, enabled.id, { enabled: true }, TEST_ACTOR);
    await campaignService.create(brandId, { name: 'Draft', rewardAmountCents: 500 }, TEST_ACTOR);

    const result = await controller.list(brandId);

    expect(result.map((campaign) => campaign.id)).toEqual([enabled.id]);
  });

  it("resolves a campaign's in-scope matches from the priced-matches pipeline", async () => {
    const campaign = await campaignService.create(brandId, { name: 'CL Bet & Get', rewardAmountCents: 500 }, TEST_ACTOR);
    await campaignService.setScopes(brandId, campaign.id, [{ scopeType: 'COMPETITION', scopeValue: 'Champions League' }], TEST_ACTOR);
    await campaignService.update(brandId, campaign.id, { enabled: true }, TEST_ACTOR);

    const inScope = buildMatch({ id: 'match-1', competition: 'Champions League' });
    const outOfScope = buildMatch({ id: 'match-2', competition: 'Premier League' });
    pricedMatchesService.listForBrand.mockResolvedValue([inScope, outOfScope]);

    const result = await controller.matchesForCampaign(brandId, campaign.id, undefined);

    expect(result.map((match) => match.id)).toEqual(['match-1']);
  });

  it('rejects matches lookup for an unknown or disabled campaign', async () => {
    await expect(controller.matchesForCampaign(brandId, 'nonexistent', undefined)).rejects.toThrow();
  });

  it('returns every enabled campaign covering a given match', async () => {
    const campaign = await campaignService.create(brandId, { name: 'CL Bet & Get', rewardAmountCents: 500 }, TEST_ACTOR);
    await campaignService.setScopes(brandId, campaign.id, [{ scopeType: 'SPORT', scopeValue: 'Football' }], TEST_ACTOR);
    await campaignService.update(brandId, campaign.id, { enabled: true }, TEST_ACTOR);

    pricedMatchesService.getForBrand.mockResolvedValue(buildMatch());

    const result = await controller.forMatch(brandId, 'match-1', undefined);

    expect(result.map((entry) => entry.id)).toEqual([campaign.id]);
  });

  it('returns an empty list for a match with no applicable campaigns', async () => {
    pricedMatchesService.getForBrand.mockResolvedValue(buildMatch({ sport: 'Basketball' }));

    expect(await controller.forMatch(brandId, 'match-1', undefined)).toEqual([]);
  });
});

import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { PlayerSegmentService } from '../player-segments/player-segment.service';
import { FreebetService } from '../freebets/freebet.service';
import { DepositCampaignService } from './deposit-campaign.service';
import { DepositService } from './deposit.service';

describe('DepositService', () => {
  let moduleRef: TestingModule;
  let depositService: DepositService;
  let campaignService: DepositCampaignService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandId: string;
  let TEST_ACTOR: AuditActor;
  let userId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Test Brand ${unique}`, slug: `test-brand-deposit-service-${unique}` },
    });
    brandId = brand.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_deposit_service', brandId };
  });

  afterAll(async () => {
    await setupPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await setupPrisma.brand.delete({ where: { id: brandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [DepositService, DepositCampaignService, PlayerSegmentService, FreebetService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    depositService = moduleRef.get(DepositService);
    campaignService = moduleRef.get(DepositCampaignService);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `test-${unique}@example.com`,
        username: `user_${unique.slice(0, 8)}`,
        phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'irrelevant',
        brandId,
        balanceCents: 0,
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
    await prisma.depositCampaign.deleteMany({ where: { brandId } });
    await moduleRef.close();
  });

  it('rejects a non-positive deposit amount', async () => {
    await expect(depositService.recordDeposit(userId, 0)).rejects.toThrow('must be positive');
    await expect(depositService.recordDeposit(userId, -100)).rejects.toThrow('must be positive');
  });

  it('credits the balance and records a Deposit row even with no matching campaign', async () => {
    const { deposit, redemption } = await depositService.recordDeposit(userId, 5_000);

    expect(deposit.amountCents).toBe(5_000);
    expect(redemption).toBeNull();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balanceCents).toBe(5_000);
  });

  it('does not create a redemption when the deposit is below the campaign minimum', async () => {
    await campaignService.create(
      brandId,
      { name: 'Deposit Boost', minDepositAmountCents: 10_000, rewardType: 'FIXED', fixedRewardAmountCents: 1_000 },
      TEST_ACTOR,
    );
    const enabled = await campaignService.list(brandId);
    await campaignService.update(brandId, enabled[0]!.id, { enabled: true }, TEST_ACTOR);

    const { redemption } = await depositService.recordDeposit(userId, 5_000);
    expect(redemption).toBeNull();
  });

  it('grants a FIXED reward immediately when requiresBet is false', async () => {
    const campaign = await campaignService.create(
      brandId,
      {
        name: 'Deposit Boost',
        minDepositAmountCents: 5_000,
        rewardType: 'FIXED',
        fixedRewardAmountCents: 1_000,
        requiresBet: false,
      },
      TEST_ACTOR,
    );
    await campaignService.update(brandId, campaign.id, { enabled: true }, TEST_ACTOR);

    const { redemption } = await depositService.recordDeposit(userId, 5_000);
    expect(redemption?.status).toBe('GRANTED');
    expect(redemption?.rewardAmountCents).toBe(1_000);

    const grants = await prisma.freebetGrant.findMany({ where: { userId } });
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ source: 'DEPOSIT_CAMPAIGN', sourceCampaignId: campaign.id, amountCents: 1_000 });
  });

  it('computes a capped PERCENTAGE reward at creation time', async () => {
    const campaign = await campaignService.create(
      brandId,
      {
        name: 'Percent Boost',
        minDepositAmountCents: 1_000,
        rewardType: 'PERCENTAGE',
        rewardPercent: 50,
        rewardCapCents: 2_000,
        requiresBet: false,
      },
      TEST_ACTOR,
    );
    await campaignService.update(brandId, campaign.id, { enabled: true }, TEST_ACTOR);

    const { redemption } = await depositService.recordDeposit(userId, 100_000);
    expect(redemption?.rewardAmountCents).toBe(2_000);
  });

  it('creates a PENDING_BET redemption without granting anything when requiresBet is true', async () => {
    const campaign = await campaignService.create(
      brandId,
      {
        name: 'Deposit + Bet',
        minDepositAmountCents: 5_000,
        rewardType: 'FIXED',
        fixedRewardAmountCents: 1_000,
        requiresBet: true,
      },
      TEST_ACTOR,
    );
    await campaignService.update(brandId, campaign.id, { enabled: true }, TEST_ACTOR);

    const { redemption } = await depositService.recordDeposit(userId, 5_000);
    expect(redemption?.status).toBe('PENDING_BET');

    expect(await prisma.freebetGrant.count({ where: { userId } })).toBe(0);
  });

  it('never creates a second redemption once the player has exhausted a single-redemption campaign', async () => {
    const campaign = await campaignService.create(
      brandId,
      { name: 'One shot', minDepositAmountCents: 1_000, rewardType: 'FIXED', fixedRewardAmountCents: 500 },
      TEST_ACTOR,
    );
    await campaignService.update(brandId, campaign.id, { enabled: true }, TEST_ACTOR);

    await depositService.recordDeposit(userId, 1_000);
    const { redemption } = await depositService.recordDeposit(userId, 1_000);

    expect(redemption).toBeNull();
    expect(await prisma.depositCampaignRedemption.count({ where: { userId, depositCampaignId: campaign.id } })).toBe(1);
  });
});

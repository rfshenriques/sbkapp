import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { DepositCampaignService } from './deposit-campaign.service';
import { PublicDepositCampaignController } from './public-deposit-campaign.controller';

describe('PublicDepositCampaignController', () => {
  let moduleRef: TestingModule;
  let controller: PublicDepositCampaignController;
  let campaignService: DepositCampaignService;
  let prisma: PrismaService;
  let brandId: string;
  let TEST_ACTOR: AuditActor;

  beforeAll(async () => {
    const setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Public Deposit Campaign Brand ${unique}`, slug: `public-deposit-campaign-brand-${unique}` },
    });
    brandId = brand.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_public_deposit_campaign', brandId };
    await setupPrisma.$disconnect();
  });

  afterAll(async () => {
    const cleanupPrisma = new PrismaService();
    await cleanupPrisma.brand.delete({ where: { id: brandId } });
    await cleanupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PublicDepositCampaignController],
      providers: [DepositCampaignService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(PublicDepositCampaignController);
    campaignService = moduleRef.get(DepositCampaignService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.depositCampaign.deleteMany({ where: { brandId } });
    await moduleRef.close();
  });

  it('returns an enabled campaign by id', async () => {
    const campaign = await campaignService.create(
      brandId,
      { name: 'Deposit Boost', minDepositAmountCents: 5_000, rewardType: 'FIXED', fixedRewardAmountCents: 1_000 },
      TEST_ACTOR,
    );
    await campaignService.update(brandId, campaign.id, { enabled: true }, TEST_ACTOR);

    const result = await controller.get(brandId, campaign.id);

    expect(result.id).toBe(campaign.id);
  });

  it('rejects a disabled campaign - a draft, not a "closed" promo', async () => {
    const campaign = await campaignService.create(
      brandId,
      { name: 'Draft', minDepositAmountCents: 5_000, rewardType: 'FIXED', fixedRewardAmountCents: 1_000 },
      TEST_ACTOR,
    );

    await expect(controller.get(brandId, campaign.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an unknown campaign id', async () => {
    await expect(controller.get(brandId, 'nonexistent')).rejects.toBeInstanceOf(NotFoundException);
  });
});

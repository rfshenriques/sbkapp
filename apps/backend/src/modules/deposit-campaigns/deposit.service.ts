import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlayerSegmentService } from '../player-segments/player-segment.service';
import { FreebetService } from '../freebets/freebet.service';
import { computeDepositReward } from './deposit-campaign';
import { DepositCampaignService } from './deposit-campaign.service';

/**
 * Records a player's (paper-money) deposit and evaluates it against the
 * brand's enabled DepositCampaigns - the trigger event those campaigns
 * react to. See DepositCampaign in schema.prisma for the full reward-rules
 * shape and PamService for how a campaign that also requiresBet gets its
 * bet-requirement matched against a later bet.
 */
@Injectable()
export class DepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depositCampaignService: DepositCampaignService,
    private readonly playerSegmentService: PlayerSegmentService,
    private readonly freebetService: FreebetService,
  ) {}

  async recordDeposit(userId: string, amountCents: number) {
    if (amountCents <= 0) {
      throw new BadRequestException('Deposit amount must be positive');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const segmentIds = await this.playerSegmentService.resolveSegmentIdsForUser(userId);
    const campaign = await this.depositCampaignService.resolveEligibleForPlayer(user.brandId, userId, {
      isLoggedIn: true,
      segmentIds,
    });
    // Eligibility (audience + canRedeem) doesn't depend on the deposit
    // amount - that's checked separately below via computeDepositReward,
    // since a campaign can be eligible in every other way and still not be
    // met by a too-small deposit.
    const rewardAmountCents = campaign
      ? computeDepositReward(
          {
            minDepositAmountCents: campaign.minDepositAmountCents,
            rewardType: campaign.rewardType,
            fixedRewardAmountCents: campaign.fixedRewardAmountCents,
            rewardPercent: campaign.rewardPercent,
            rewardCapCents: campaign.rewardCapCents,
          },
          amountCents,
        )
      : null;

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { balanceCents: { increment: amountCents } } });
      const deposit = await tx.deposit.create({ data: { userId, brandId: user.brandId, amountCents } });

      if (!campaign || rewardAmountCents === null) {
        return { deposit, redemption: null };
      }

      const redemption = await tx.depositCampaignRedemption.create({
        data: {
          depositCampaignId: campaign.id,
          userId,
          brandId: user.brandId,
          depositId: deposit.id,
          rewardAmountCents,
          status: campaign.requiresBet ? 'PENDING_BET' : 'GRANTED',
        },
      });

      if (!campaign.requiresBet) {
        await this.freebetService.grantSystem(
          {
            userId,
            brandId: user.brandId,
            amountCents: rewardAmountCents,
            source: 'DEPOSIT_CAMPAIGN',
            sourceCampaignId: campaign.id,
          },
          tx,
        );
      }

      return { deposit, redemption };
    });
  }
}

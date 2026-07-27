import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BetStatus, SelectionStatus } from '@prisma/client';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AccaBoostService } from '../acca-boost/acca-boost.service';
import { calculateAccaBoost } from '../acca-boost/acca-boost';
import { AccaRollbackService } from '../acca-rollback/acca-rollback.service';
import { calculateAccaRollbackReward } from '../acca-rollback/acca-rollback';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { BetAndGetCampaignService } from '../bet-and-get/bet-and-get-campaign.service';
import { BoostService } from '../boosts/boost.service';
import { DepositCampaignService } from '../deposit-campaigns/deposit-campaign.service';
import { FreebetService } from '../freebets/freebet.service';
import { InsuranceBetService } from '../insurance-bet/insurance-bet.service';
import { calculateInsuredPayout } from '../insurance-bet/insurance-bet';
import {
  maxStakeFromLiability,
  minIgnoringNull,
  resolveBetLimit,
  type LegContext,
  type PlayerExposure,
} from '../limits/stake-limits';
import { ManualMarketService } from '../manual-markets/manual-market.service';
import { OddsEngineClient } from '../margins/odds-engine-client';
import { computeBetOutcome } from './bet-settlement';
import { CompetitionSuspensionService } from './competition-suspension.service';
import type { BetSelectionDto, PlaceBetDto } from './dto/place-bet.dto';
import { MarketSuspensionService } from './market-suspension.service';

function formatEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Every field optional and independently combinable - see listBetsForSettlement. */
export interface ListBetsFilters {
  status?: BetStatus;
  from?: Date;
  to?: Date;
  player?: string;
  fundedByFreebets?: boolean;
  insured?: boolean;
  boosted?: boolean;
  hasCampaign?: boolean;
  sport?: string;
  competition?: string;
}

@Injectable()
export class PamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly marketSuspensionService: MarketSuspensionService,
    private readonly competitionSuspensionService: CompetitionSuspensionService,
    private readonly oddsEngineClient: OddsEngineClient,
    private readonly accaBoostService: AccaBoostService,
    private readonly accaRollbackService: AccaRollbackService,
    private readonly manualMarketService: ManualMarketService,
    private readonly boostService: BoostService,
    private readonly freebetService: FreebetService,
    private readonly insuranceBetService: InsuranceBetService,
    private readonly betAndGetCampaignService: BetAndGetCampaignService,
    private readonly depositCampaignService: DepositCampaignService,
  ) {}

  async getWallet(userId: string): Promise<{ balanceCents: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { balanceCents: user.balanceCents };
  }

  /** The player's own spendable freebets - what the bet slip's Cash/Freebets toggle reads to decide whether to show at all, and what it lets them pick from. */
  async getFreebets(userId: string) {
    const { brandId } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { brandId: true },
    });
    return this.freebetService.listActive(userId, brandId);
  }

  /**
   * Every selection's match, looked up from odds-engine (competitions are
   * never persisted) - deliberately done before the DB transaction opens,
   * so a slow/failed HTTP call never holds a Postgres transaction open.
   * Shared by the competition-suspension check and the stake-limit
   * resolution below, so a bet with N selections costs at most N distinct
   * odds-engine calls, not 2N.
   */
  private async fetchMatchesByMatchId(selections: BetSelectionDto[]): Promise<Map<string, Match>> {
    const uniqueMatchIds = [...new Set(selections.map((selection) => selection.matchId))];
    const matches = await Promise.all(
      uniqueMatchIds.map((matchId) => this.oddsEngineClient.fetchMatchById(matchId)),
    );
    return new Map(uniqueMatchIds.map((matchId, index) => [matchId, matches[index]!]));
  }

  private async assertNoCompetitionSuspended(brandId: string, matchesById: Map<string, Match>): Promise<void> {
    for (const match of matchesById.values()) {
      if (await this.competitionSuspensionService.isSuspended(brandId, match.competition)) {
        throw new BadRequestException(`Competition is suspended: ${match.competition}`);
      }
    }
  }

  /**
   * Resolves each leg's own max stake/liability (see resolveBetLimit - an
   * accumulator's effective cap is the smallest one across its legs),
   * player-override-aware. Shared by the placement-time enforcement below
   * and the bet-slip preview endpoint, so both always agree on what the
   * cap actually is. A brand with no StakeLimit rows at all skips the DB
   * round-trip entirely - most brands never configure this.
   */
  private async resolveStakeLimit(
    userId: string | null,
    brandId: string,
    selections: BetSelectionDto[],
    matchesById: Map<string, Match>,
  ): Promise<{ maxStakeCents: number | null; maxLiabilityCents: number | null }> {
    const limitRows = await this.prisma.stakeLimit.findMany({ where: { brandId } });
    if (limitRows.length === 0) {
      return { maxStakeCents: null, maxLiabilityCents: null };
    }

    const tiers = await this.prisma.competitionTier.findMany({ where: { brandId } });
    const tierByCompetition = new Map(tiers.map((row) => [row.competition, row.tier]));

    const legs: LegContext[] = selections.map((selection) => {
      const match = matchesById.get(selection.matchId);
      if (!match) {
        throw new NotFoundException('Match not found');
      }
      return {
        sport: match.sport,
        country: match.country,
        competition: match.competition,
        marketName: selection.marketName,
        tier: tierByCompetition.get(match.competition),
      };
    });

    // Only worth the extra round-trip when this player actually has a
    // PLAYER-scoped row - most bets never touch it.
    const player =
      userId && limitRows.some((row) => row.scope === 'PLAYER' && row.scopeValue === userId)
        ? await this.buildPlayerExposure(userId)
        : undefined;

    return resolveBetLimit(limitRows, legs, player);
  }

  /**
   * Resolves each leg's own max stake/liability and rejects the bet if it
   * exceeds either - see resolveStakeLimit for how the cap itself is
   * computed.
   */
  private async assertWithinStakeLimits(
    userId: string,
    brandId: string,
    dto: PlaceBetDto,
    matchesById: Map<string, Match>,
    potentialPayoutCents: number,
  ): Promise<void> {
    const limit = await this.resolveStakeLimit(userId, brandId, dto.selections, matchesById);
    if (limit.maxStakeCents !== null && dto.stakeCents > limit.maxStakeCents) {
      throw new BadRequestException(
        `Stake exceeds the maximum allowed for this bet (max €${formatEuros(limit.maxStakeCents)})`,
      );
    }
    const liabilityCents = potentialPayoutCents - dto.stakeCents;
    if (limit.maxLiabilityCents !== null && liabilityCents > limit.maxLiabilityCents) {
      throw new BadRequestException(
        `Potential liability exceeds the maximum allowed for this bet (max €${formatEuros(limit.maxLiabilityCents)})`,
      );
    }
  }

  /**
   * The bet-slip's own preview of what resolveStakeLimit would allow, so
   * the frontend can warn the player before they try to place a bet that
   * would just get rejected. `maxLiabilityCents` is converted into stake
   * terms via the bet's own combined odds (see maxStakeFromLiability) so
   * the frontend has one number to compare a typed stake against;
   * `maxStakeCents`/`maxLiabilityCents` are also returned raw so the UI can
   * say *why* a cap applies. `userId` is null for a logged-out browser - a
   * PLAYER-scoped override, being player-specific, simply can't apply yet.
   */
  async previewStakeLimit(
    userId: string | null,
    brandId: string,
    selections: BetSelectionDto[],
  ): Promise<{ maxStakeCents: number | null; maxLiabilityCents: number | null; effectiveMaxStakeCents: number | null }> {
    const matchesById = await this.fetchMatchesByMatchId(selections);
    const limit = await this.resolveStakeLimit(userId, brandId, selections, matchesById);

    const accaBoostConfig = await this.accaBoostService.getConfig(brandId);
    const { boostedCombinedOdds } = calculateAccaBoost(
      selections.map((selection) => selection.odds),
      accaBoostConfig,
    );

    return {
      ...limit,
      effectiveMaxStakeCents: minIgnoringNull([
        limit.maxStakeCents,
        maxStakeFromLiability(limit.maxLiabilityCents, boostedCombinedOdds),
      ]),
    };
  }

  /**
   * The bet slip's own preview of which campaign(s), if any, this exact bet
   * would link to at placement (see the matching resolution inside
   * placeBet below) - so the player can see "you'll get €X" before
   * committing, same soft-auth shape as previewStakeLimit. A bet can link
   * to a Bet & Get campaign AND a deposit campaign redemption at once (they're
   * independent fields on Bet), so both are previewed and returned
   * together rather than picking one. Deposit campaign redemptions are
   * matched against a specific already-logged-in player's own pending
   * redemption (see DepositCampaignService.resolvePendingBetRedemption) -
   * that half is simply null for a logged-out preview, same as a
   * PLAYER-scoped stake-limit override not applying yet.
   */
  async previewCampaign(
    userId: string | null,
    brandId: string,
    selections: BetSelectionDto[],
    stakeCents: number,
  ): Promise<{
    betAndGetCampaignName: string | null;
    betAndGetCampaignRewardCents: number | null;
    depositCampaignName: string | null;
    depositCampaignRewardCents: number | null;
  }> {
    const matchesById = await this.fetchMatchesByMatchId(selections);
    const qualifyingBet = { stakeCents, legOdds: selections.map((selection) => selection.odds) };

    const applicableCampaign = await this.betAndGetCampaignService.resolveApplicableCampaign(
      brandId,
      selections.map((selection) => {
        const match = matchesById.get(selection.matchId)!;
        return { sport: match.sport, competition: match.competition, matchId: selection.matchId };
      }),
      qualifyingBet,
    );
    const betAndGetCampaign =
      applicableCampaign &&
      (userId === null || (await this.betAndGetCampaignService.canRedeem(applicableCampaign, userId)))
        ? applicableCampaign
        : null;

    const depositCampaignRedemption = userId
      ? await this.depositCampaignService.resolvePendingBetRedemption(userId, qualifyingBet)
      : null;

    return {
      betAndGetCampaignName: betAndGetCampaign?.name ?? null,
      betAndGetCampaignRewardCents: betAndGetCampaign?.rewardAmountCents ?? null,
      depositCampaignName: depositCampaignRedemption?.depositCampaign.name ?? null,
      depositCampaignRewardCents: depositCampaignRedemption?.rewardAmountCents ?? null,
    };
  }

  /** What a player already has riding on their own currently-PENDING bets - see PlayerExposure in stake-limits.ts. */
  private async buildPlayerExposure(userId: string): Promise<PlayerExposure> {
    const pending = await this.prisma.bet.findMany({
      where: { userId, status: 'PENDING' },
      select: { stakeCents: true, potentialPayoutCents: true },
    });
    return {
      userId,
      existingStakedCents: pending.reduce((sum, bet) => sum + bet.stakeCents, 0),
      existingLiabilityCents: pending.reduce((sum, bet) => sum + (bet.potentialPayoutCents - bet.stakeCents), 0),
    };
  }

  /**
   * A manual market's own stake/liability caps (see ManualMarketService),
   * separate from the brand-wide StakeLimit system above - set per market
   * by the trader who created it. Each leg's liability is judged on its
   * own odds (stake * (odds - 1)), not the accumulator's combined payout -
   * decomposing a multi-leg bet's combined liability back to one market's
   * share of it isn't well-defined, and traders think about a market's
   * exposure in terms of what that market alone is risking.
   */
  private async assertWithinManualMarketLimitsAndCollectLiability(
    brandId: string,
    dto: PlaceBetDto,
    matchesById: Map<string, Match>,
  ): Promise<{ marketId: string; liabilityCents: number }[]> {
    const toRecord: { marketId: string; liabilityCents: number }[] = [];

    for (const selection of dto.selections) {
      const market = await this.manualMarketService.findForBet(brandId, selection.marketId);
      if (!market) {
        continue;
      }

      // A manually-priced market has no live re-pricing feed behind it - it
      // shouldn't have been shown to the player once the match went
      // in-play, but check again here as defense in depth (same rationale
      // as the market suspension check above).
      if (matchesById.get(selection.matchId)?.isLive && !market.staysLiveDuringInplay) {
        throw new BadRequestException(`${market.name} is no longer available now that this match is in-play`);
      }

      // A trader can mark a novelty/special market singles-only when its
      // price can't account for correlation with other legs - reject the
      // whole bet rather than silently drop the leg.
      if (market.singlesOnly && dto.selections.length > 1) {
        throw new BadRequestException(`${market.name} can only be bet as a single, not combined in an accumulator`);
      }

      if (market.maxStakeCents !== null && dto.stakeCents > market.maxStakeCents) {
        throw new BadRequestException(
          `Stake exceeds the maximum allowed for ${market.name} (max €${formatEuros(market.maxStakeCents)})`,
        );
      }

      const legLiabilityCents = Math.round(dto.stakeCents * (selection.odds - 1));
      if (
        market.maxLiabilityCents !== null &&
        market.currentLiabilityCents + legLiabilityCents > market.maxLiabilityCents
      ) {
        throw new BadRequestException(
          `This bet would exceed the maximum liability allowed for ${market.name} (max €${formatEuros(market.maxLiabilityCents)})`,
        );
      }

      toRecord.push({ marketId: market.id, liabilityCents: legLiabilityCents });
    }

    return toRecord;
  }

  /**
   * A boost's own stake/liability caps (see BoostService), separate from
   * the brand-wide StakeLimit system above. A leg's liability is judged
   * on its own (boosted) odds, same simplification as manual markets -
   * see assertWithinManualMarketLimitsAndCollectLiability.
   */
  private async assertWithinBoostLimitsAndCollectLiability(
    brandId: string,
    dto: PlaceBetDto,
    matchesById: Map<string, Match>,
  ): Promise<{ boostId: string; liabilityCents: number }[]> {
    const toRecord: { boostId: string; liabilityCents: number }[] = [];

    for (const selection of dto.selections) {
      const boost = await this.boostService.findActiveForBet(
        brandId,
        selection.matchId,
        selection.marketId,
        selection.selectionId,
      );
      if (!boost) {
        continue;
      }

      // A boosted price has no live re-pricing behind the boost itself -
      // defense in depth, same rationale as the manual market check above.
      if (matchesById.get(selection.matchId)?.isLive && !boost.staysLiveDuringInplay) {
        throw new BadRequestException('This boosted price is no longer available now that this match is in-play');
      }

      if (boost.maxStakeCents !== null && dto.stakeCents > boost.maxStakeCents) {
        throw new BadRequestException(
          `Stake exceeds the maximum allowed for this boosted price (max €${formatEuros(boost.maxStakeCents)})`,
        );
      }

      const legLiabilityCents = Math.round(dto.stakeCents * (selection.odds - 1));
      if (
        boost.maxLiabilityCents !== null &&
        boost.currentLiabilityCents + legLiabilityCents > boost.maxLiabilityCents
      ) {
        throw new BadRequestException(
          `This bet would exceed the maximum liability allowed for this boosted price (max €${formatEuros(boost.maxLiabilityCents)})`,
        );
      }

      toRecord.push({ boostId: boost.id, liabilityCents: legLiabilityCents });
    }

    // A boosted price is priced in isolation, without accounting for
    // correlation with another leg's own boosted price - combining two in
    // one accumulator would understate the book's real exposure, so only
    // one boosted selection is ever allowed per bet.
    if (dto.selections.length > 1 && toRecord.length > 1) {
      throw new BadRequestException('Only one boosted selection can be combined in an accumulator');
    }

    return toRecord;
  }

  /**
   * A boosted price already prices in extra risk the book chose to eat, and
   * a singles-only market's price already assumes no correlation cushion -
   * insuring either on top would stack a guaranteed-stake-back reward onto
   * a price that's already subsidized, the same double-bonusing rationale
   * that keeps insurance apart from freebets and acca boost.
   */
  private async assertInsuranceEligible(brandId: string, dto: PlaceBetDto): Promise<void> {
    for (const selection of dto.selections) {
      const boost = await this.boostService.findActiveForBet(
        brandId,
        selection.matchId,
        selection.marketId,
        selection.selectionId,
      );
      if (boost) {
        throw new BadRequestException('Insurance is not available on a boosted selection');
      }

      const market = await this.manualMarketService.findForBet(brandId, selection.marketId);
      if (market?.singlesOnly) {
        throw new BadRequestException(`Insurance is not available on ${market.name}`);
      }
    }
  }

  /**
   * Two selections from different markets on the same event are correlated
   * in a way a plain product-of-odds accumulator price doesn't account for
   * (e.g. Over 2.5 Goals + Home Win) - pricing that correctly is the whole
   * point of a dedicated bet builder, not something this simple accumulator
   * can safely offer yet. Singles are unaffected since each is priced and
   * settled independently.
   */
  private assertNoSameEventAccumulator(dto: PlaceBetDto): void {
    if (dto.selections.length < 2) {
      return;
    }
    const matchIds = dto.selections.map((selection) => selection.matchId);
    if (new Set(matchIds).size !== matchIds.length) {
      throw new BadRequestException(
        "Selections from the same event can't be combined into an accumulator",
      );
    }
  }

  async placeBet(userId: string, dto: PlaceBetDto) {
    const { brandId } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { brandId: true },
    });
    this.assertNoSameEventAccumulator(dto);
    const matchesById = await this.fetchMatchesByMatchId(dto.selections);
    await this.assertNoCompetitionSuspended(brandId, matchesById);

    // Freebets fund from a pooled balance the player can stake any typed
    // amount from (like a second wallet), not a fixed-value token - and
    // never combine with acca boost, to avoid double-bonusing the same bet
    // (same rule applies to acca rollback/insurance bet below).
    const useFreebets = Boolean(dto.useFreebets);
    if (useFreebets) {
      const freebetsBalanceCents = await this.freebetService.balanceCents(userId, brandId);
      if (freebetsBalanceCents < dto.stakeCents) {
        throw new BadRequestException('Insufficient freebets balance');
      }
    }

    // Insurance is priced per-bet (no minimum leg count) and, like acca
    // boost, never applies on a freebet-funded bet - the premium would
    // reduce a payout the player never paid cash for in the first place.
    // Fetched before acca boost below since a bet insured against loss
    // never also gets boosted odds - stacking a guaranteed-stake-back
    // reward with a price boost would be double-bonusing the same bet,
    // same rule that already keeps freebets and acca boost apart.
    const insuranceBetConfig = await this.insuranceBetService.getConfig(brandId);
    const insuranceOptedIn = Boolean(dto.insuranceOptIn) && !useFreebets;
    const insuranceApplies = insuranceOptedIn && insuranceBetConfig.enabled;
    if (insuranceApplies) {
      await this.assertInsuranceEligible(brandId, dto);
    }

    const accaBoostConfig = await this.accaBoostService.getConfig(brandId);
    const rawBoost = calculateAccaBoost(
      dto.selections.map((selection) => selection.odds),
      accaBoostConfig,
    );
    const boost =
      useFreebets || insuranceApplies
        ? { boostedCombinedOdds: rawBoost.baseCombinedOdds, boostPercent: 0 }
        : rawBoost;
    const combinedOdds = boost.boostedCombinedOdds;
    const rawPotentialPayoutCents = Math.round(dto.stakeCents * combinedOdds);

    const insurancePricing = calculateInsuredPayout(rawPotentialPayoutCents, insuranceOptedIn, insuranceBetConfig);
    const potentialPayoutCents = insurancePricing.insuredPayoutCents;

    await this.assertWithinStakeLimits(userId, brandId, dto, matchesById, potentialPayoutCents);
    const manualMarketLiabilityToRecord = await this.assertWithinManualMarketLimitsAndCollectLiability(
      brandId,
      dto,
      matchesById,
    );
    const boostLiabilityToRecord = await this.assertWithinBoostLimitsAndCollectLiability(brandId, dto, matchesById);

    // Resolved once here from live match data (every selection's match must
    // fall within the campaign's scope, not just one leg) and snapshotted on
    // the bet below - never re-derived at settlement, so a later scope or
    // condition change never retroactively relabels an already-placed bet.
    // A player who's already exhausted their redemptions for this campaign
    // simply doesn't link to it at all, same as not qualifying by scope.
    const applicableCampaign = await this.betAndGetCampaignService.resolveApplicableCampaign(
      brandId,
      dto.selections.map((selection) => {
        const match = matchesById.get(selection.matchId)!;
        return { sport: match.sport, competition: match.competition, matchId: selection.matchId };
      }),
      { stakeCents: dto.stakeCents, legOdds: dto.selections.map((selection) => selection.odds) },
    );
    const betAndGetCampaign =
      applicableCampaign && (await this.betAndGetCampaignService.canRedeem(applicableCampaign, userId))
        ? applicableCampaign
        : null;

    // Unlike betAndGetCampaign (resolved fresh from the bet's own
    // scope/conditions), this matches against a redemption that already
    // exists - created back when the qualifying deposit was made - so
    // there's no separate canRedeem check here, the redemption's mere
    // existence already represents a consumed slot.
    const depositCampaignRedemption = await this.depositCampaignService.resolvePendingBetRedemption(userId, {
      stakeCents: dto.stakeCents,
      legOdds: dto.selections.map((selection) => selection.odds),
    });

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!useFreebets && user.balanceCents < dto.stakeCents) {
        throw new BadRequestException('Insufficient balance');
      }

      for (const selection of dto.selections) {
        const suspended = await this.marketSuspensionService.isSuspended(
          user.brandId,
          selection.matchId,
          selection.marketId,
          selection.selectionId,
          tx,
        );
        if (suspended) {
          throw new BadRequestException(
            `Market is suspended: ${selection.matchLabel} - ${selection.marketName}`,
          );
        }
      }

      if (!useFreebets) {
        await tx.user.update({
          where: { id: userId },
          data: { balanceCents: { decrement: dto.stakeCents } },
        });
      }

      const bet = await tx.bet.create({
        data: {
          userId,
          brandId: user.brandId,
          stakeCents: dto.stakeCents,
          combinedOdds,
          potentialPayoutCents,
          accaBoostPercent: boost.boostPercent,
          insuranceCostPercent: insurancePricing.costPercent,
          fundedByFreebets: useFreebets,
          betAndGetCampaignId: betAndGetCampaign?.id,
          depositCampaignRedemptionId: depositCampaignRedemption?.id,
          selections: {
            create: dto.selections.map((selection) => {
              const match = matchesById.get(selection.matchId);
              return {
                matchId: selection.matchId,
                marketId: selection.marketId,
                selectionId: selection.selectionId,
                matchLabel: selection.matchLabel,
                marketName: selection.marketName,
                selectionName: selection.selectionName,
                odds: selection.odds,
                sport: match?.sport,
                competition: match?.competition,
              };
            }),
          },
        },
        include: { selections: true },
      });

      if (useFreebets) {
        await this.freebetService.spendFromBalance(userId, user.brandId, dto.stakeCents, bet.id, tx);
      }

      // A SETTLEMENT-triggered campaign already has its reward deferred by
      // simply not granting here - settleSelection checks betAndGetCampaignId
      // once the bet's outcome is known.
      if (betAndGetCampaign && betAndGetCampaign.trigger === 'PLACEMENT') {
        await this.freebetService.grantSystem(
          {
            userId,
            brandId: user.brandId,
            amountCents: betAndGetCampaign.rewardAmountCents,
            source: 'BET_AND_GET',
            sourceBetId: bet.id,
            sourceCampaignId: betAndGetCampaign.id,
          },
          tx,
        );
      }

      // Same PLACEMENT-vs-SETTLEMENT deferral as betAndGetCampaign above,
      // just tracked via the redemption's own status instead of a trigger
      // read straight off the bet - settleSelection checks
      // depositCampaignRedemptionId once the bet's outcome is known.
      if (depositCampaignRedemption) {
        const campaign = depositCampaignRedemption.depositCampaign;
        if (campaign.trigger === 'PLACEMENT') {
          await this.freebetService.grantSystem(
            {
              userId,
              brandId: user.brandId,
              amountCents: depositCampaignRedemption.rewardAmountCents,
              source: 'DEPOSIT_CAMPAIGN',
              sourceBetId: bet.id,
              sourceCampaignId: campaign.id,
            },
            tx,
          );
          await tx.depositCampaignRedemption.update({
            where: { id: depositCampaignRedemption.id },
            data: { status: 'GRANTED' },
          });
        } else {
          await tx.depositCampaignRedemption.update({
            where: { id: depositCampaignRedemption.id },
            data: { status: 'PENDING_SETTLEMENT' },
          });
        }
      }

      for (const { marketId, liabilityCents } of manualMarketLiabilityToRecord) {
        // No staff member triggered a possible auto-disable here - the liability cap itself did, as this bet's own placement pushed it over.
        await this.manualMarketService.recordLiabilityAndMaybeDisable(
          marketId,
          liabilityCents,
          { id: 'system', username: 'system:manual-market-auto-disable', brandId: user.brandId },
          tx,
        );
      }

      for (const { boostId, liabilityCents } of boostLiabilityToRecord) {
        // No staff member triggered a possible auto-disable here - the liability cap itself did, as this bet's own placement pushed it over.
        await this.boostService.recordLiabilityAndMaybeDisable(
          boostId,
          liabilityCents,
          { id: 'system', username: 'system:boost-auto-disable', brandId: user.brandId },
          tx,
        );
      }

      return {
        ...bet,
        betAndGetCampaignName: betAndGetCampaign?.name ?? null,
        betAndGetCampaignRewardCents: betAndGetCampaign?.rewardAmountCents ?? null,
        depositCampaignName: depositCampaignRedemption?.depositCampaign.name ?? null,
        depositCampaignRewardCents: depositCampaignRedemption?.rewardAmountCents ?? null,
        // Acca rollback is only ever known once the bet settles - never at placement.
        accaRollbackRewardCents: null,
      };
    });
  }

  async getBets(userId: string) {
    const bets = await this.prisma.bet.findMany({
      where: { userId },
      include: {
        selections: true,
        betAndGetCampaign: { select: { name: true, rewardAmountCents: true } },
        depositCampaignRedemption: { include: { depositCampaign: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.enrichBetsWithRollbackReward(bets);
  }

  /**
   * Admin-only: lists bets across all users in one brand - used both by the
   * settlement queue (status filter only) and the Reports > Bet History
   * page (the fuller filter set below). Every filter here is optional and
   * backed by a real stored column - sport/competition match against
   * BetSelection's snapshotted values (see placeBet), so bets placed before
   * that field existed simply won't match a sport/competition filter.
   */
  async listBetsForSettlement(brandId: string, filters: ListBetsFilters = {}) {
    const { status, from, to, player, fundedByFreebets, insured, boosted, hasCampaign, sport, competition } =
      filters;
    const bets = await this.prisma.bet.findMany({
      where: {
        brandId,
        ...(status ? { status } : {}),
        ...(from || to
          ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
        ...(player
          ? {
              user: {
                OR: [
                  { username: { contains: player, mode: 'insensitive' } },
                  { email: { contains: player, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
        ...(fundedByFreebets !== undefined ? { fundedByFreebets } : {}),
        ...(insured !== undefined
          ? { insuranceCostPercent: insured ? { gt: 0 } : 0 }
          : {}),
        ...(boosted !== undefined ? { accaBoostPercent: boosted ? { gt: 0 } : 0 } : {}),
        ...(hasCampaign !== undefined
          ? hasCampaign
            ? { OR: [{ betAndGetCampaignId: { not: null } }, { depositCampaignRedemptionId: { not: null } }] }
            : { betAndGetCampaignId: null, depositCampaignRedemptionId: null }
          : {}),
        ...(sport || competition
          ? { selections: { some: { ...(sport ? { sport } : {}), ...(competition ? { competition } : {}) } } }
          : {}),
      },
      include: {
        selections: true,
        user: { select: { id: true, username: true, email: true } },
        betAndGetCampaign: { select: { name: true, rewardAmountCents: true } },
        depositCampaignRedemption: { include: { depositCampaign: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return this.enrichBetsWithRollbackReward(bets);
  }

  /**
   * Distinct sport/competition values seen on this brand's bets, so the
   * Bet History report can offer real dropdown options instead of
   * free-text input or a fabricated static list. Bets placed before
   * BetSelection.sport/competition existed are simply absent from either
   * list, not shown as blank/unknown entries.
   */
  async listBetFilterOptions(brandId: string) {
    const [sports, competitions] = await Promise.all([
      this.prisma.betSelection.findMany({
        where: { bet: { brandId }, sport: { not: null } },
        select: { sport: true },
        distinct: ['sport'],
      }),
      this.prisma.betSelection.findMany({
        where: { bet: { brandId }, competition: { not: null } },
        select: { competition: true },
        distinct: ['competition'],
      }),
    ]);
    return {
      sports: sports.map((row) => row.sport!).sort(),
      competitions: competitions.map((row) => row.competition!).sort(),
    };
  }

  /**
   * A bet carries no field of its own recording an acca rollback reward -
   * it's a side effect recorded only as a FreebetGrant with
   * source: 'ACCA_ROLLBACK' and sourceBetId pointing back at it (see
   * FreebetGrant.sourceBetId doc comment). Bet history (player-facing and
   * admin settlement) both want to show "you got €X back as a freebet" next
   * to the bet it came from, so this joins that in as a derived
   * accaRollbackRewardCents field rather than storing it redundantly on Bet
   * itself - same reasoning as re-deriving accaBoostPercent/insuredCredited
   * instead of trusting a stored value (see settleSelection).
   */
  private async enrichBetsWithRollbackReward<
    T extends {
      id: string;
      betAndGetCampaign: { name: string; rewardAmountCents: number } | null;
      depositCampaignRedemption: { depositCampaign: { name: string }; rewardAmountCents: number } | null;
    },
  >(bets: T[]) {
    const betIds = bets.map((bet) => bet.id);
    const rollbackGrants = betIds.length
      ? await this.prisma.freebetGrant.findMany({
          where: { source: 'ACCA_ROLLBACK', sourceBetId: { in: betIds } },
          select: { sourceBetId: true, amountCents: true },
        })
      : [];
    const rollbackRewardByBetId = new Map(rollbackGrants.map((grant) => [grant.sourceBetId, grant.amountCents]));

    return bets.map((bet) => {
      const { betAndGetCampaign, depositCampaignRedemption, ...rest } = bet;
      return {
        ...rest,
        betAndGetCampaignName: betAndGetCampaign?.name ?? null,
        betAndGetCampaignRewardCents: betAndGetCampaign?.rewardAmountCents ?? null,
        depositCampaignName: depositCampaignRedemption?.depositCampaign.name ?? null,
        depositCampaignRewardCents: depositCampaignRedemption?.rewardAmountCents ?? null,
        accaRollbackRewardCents: rollbackRewardByBetId.get(bet.id) ?? null,
      };
    });
  }

  /**
   * Admin-only: settles one selection and recomputes the whole bet's
   * outcome from every selection's current status. Re-settling a selection
   * (including back to OPEN, as a correction) claws back or tops up
   * whatever was previously credited, rather than double-crediting.
   * `brandId` must match the bet's own brand - a staff member can never
   * settle a bet belonging to another brand, even by guessing its id.
   */
  async settleSelection(
    brandId: string,
    betId: string,
    selectionId: string,
    status: SelectionStatus,
    actor: AuditActor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const selection = await tx.betSelection.findUnique({ where: { id: selectionId } });
      if (!selection || selection.betId !== betId) {
        throw new NotFoundException('Selection not found on this bet');
      }

      const bet = await tx.bet.findUniqueOrThrow({
        where: { id: betId },
        include: { selections: true },
      });
      if (bet.brandId !== brandId) {
        throw new NotFoundException('Selection not found on this bet');
      }
      const previousStatus = selection.status;

      await tx.betSelection.update({ where: { id: selectionId }, data: { status } });

      await this.auditLogService.record(
        {
          actor,
          action: 'SELECTION_SETTLED',
          targetType: 'BetSelection',
          targetId: selectionId,
          metadata: { betId, previousStatus, newStatus: status },
        },
        tx,
      );

      const updatedBet = await tx.bet.findUniqueOrThrow({
        where: { id: betId },
        include: { selections: true },
      });

      const outcome = computeBetOutcome(
        updatedBet.selections.map((betSelection) => ({
          status: betSelection.status,
          odds: Number(betSelection.odds),
        })),
        updatedBet.stakeCents,
        updatedBet.accaBoostPercent,
      );

      // computeBetOutcome returns LOST the instant any single leg loses,
      // even while siblings are still OPEN - so the losing-leg count isn't
      // final until every leg has a terminal status. Evaluating rollback
      // eligibility any earlier could grant a reward before all the facts
      // (how many legs actually lost) are in. Freebet-funded and
      // insured bets never qualify either - refunding a reward on top of a
      // bet that already carries one is the same double-bonusing acca
      // boost avoids (see placeBet's insuranceApplies gate).
      const allLegsTerminal = updatedBet.selections.every((selection) => selection.status !== 'OPEN');
      if (
        outcome.overallStatus === 'LOST' &&
        allLegsTerminal &&
        !updatedBet.fundedByFreebets &&
        updatedBet.insuranceCostPercent === 0
      ) {
        const rollbackConfig = await this.accaRollbackService.getConfig(brandId);
        const lostLegCount = updatedBet.selections.filter((selection) => selection.status === 'LOST').length;
        const reward = calculateAccaRollbackReward(
          updatedBet.selections.length,
          lostLegCount,
          updatedBet.stakeCents,
          rollbackConfig,
        );
        if (reward.qualifies) {
          await this.freebetService.grantSystem(
            {
              userId: updatedBet.userId,
              brandId,
              amountCents: reward.rewardCents,
              source: 'ACCA_ROLLBACK',
              sourceBetId: betId,
            },
            tx,
          );
        }
      }

      // Unlike acca rollback, insurance only cares whether the bet lost at
      // all, not how many legs did - and a single LOST leg permanently
      // decides that (computeBetOutcome never reverses LOST once any leg
      // has it), so this doesn't need to wait for every leg to be terminal.
      if (outcome.overallStatus === 'LOST' && updatedBet.insuranceCostPercent > 0) {
        await this.freebetService.grantSystem(
          {
            userId: updatedBet.userId,
            brandId,
            amountCents: updatedBet.stakeCents,
            source: 'INSURANCE_BET',
            sourceBetId: betId,
          },
          tx,
        );
      }

      // Only ever set when this bet linked to a SETTLEMENT-triggered
      // campaign at placement time (see placeBet) - a PLACEMENT-triggered
      // one already granted its reward there. Like insurance, a LOST
      // outcome is final the instant one leg loses and doesn't need every
      // leg terminal; WON/VOID only ever come back from computeBetOutcome
      // once every leg already is, so no extra check is needed for those.
      if (updatedBet.betAndGetCampaignId) {
        const campaign = await tx.betAndGetCampaign.findUnique({ where: { id: updatedBet.betAndGetCampaignId } });
        const outcomeTriggersCampaign =
          campaign?.trigger === 'SETTLEMENT' &&
          ((outcome.overallStatus === 'WON' && campaign.triggerOnWon) ||
            (outcome.overallStatus === 'LOST' && campaign.triggerOnLost) ||
            (outcome.overallStatus === 'VOID' && campaign.triggerOnVoid));
        if (campaign && outcomeTriggersCampaign) {
          await this.freebetService.grantSystem(
            {
              userId: updatedBet.userId,
              brandId,
              amountCents: campaign.rewardAmountCents,
              source: 'BET_AND_GET',
              sourceBetId: betId,
              sourceCampaignId: campaign.id,
            },
            tx,
          );
        }
      }

      // Same idea as betAndGetCampaignId above - only ever set when this
      // bet linked to a SETTLEMENT-triggered deposit campaign at placement
      // time (its status will be PENDING_SETTLEMENT; PLACEMENT-triggered
      // ones already granted and moved to GRANTED there).
      if (updatedBet.depositCampaignRedemptionId) {
        const redemption = await tx.depositCampaignRedemption.findUnique({
          where: { id: updatedBet.depositCampaignRedemptionId },
          include: { depositCampaign: true },
        });
        const campaign = redemption?.depositCampaign;
        const outcomeTriggersCampaign =
          redemption?.status === 'PENDING_SETTLEMENT' &&
          campaign?.trigger === 'SETTLEMENT' &&
          ((outcome.overallStatus === 'WON' && campaign.triggerOnWon) ||
            (outcome.overallStatus === 'LOST' && campaign.triggerOnLost) ||
            (outcome.overallStatus === 'VOID' && campaign.triggerOnVoid));
        if (redemption && campaign && outcomeTriggersCampaign) {
          await this.freebetService.grantSystem(
            {
              userId: updatedBet.userId,
              brandId,
              amountCents: redemption.rewardAmountCents,
              source: 'DEPOSIT_CAMPAIGN',
              sourceBetId: betId,
              sourceCampaignId: campaign.id,
            },
            tx,
          );
          await tx.depositCampaignRedemption.update({ where: { id: redemption.id }, data: { status: 'GRANTED' } });
        }
      }

      const previousCredited = updatedBet.settledPayoutCents ?? 0;
      const rawCredited = outcome.overallStatus === 'PENDING' ? 0 : outcome.payoutCents;
      // The insurance premium was already reflected in what the player was
      // shown at placement (see PamService.placeBet) - re-derive the same
      // reduction here rather than trusting a stored payout, mirroring how
      // accaBoostPercent is recomputed rather than read off the bet too.
      const insuredCredited =
        updatedBet.insuranceCostPercent > 0
          ? Math.round(rawCredited * (1 - updatedBet.insuranceCostPercent / 100))
          : rawCredited;
      // A freebet-funded bet that LOSes or VOIDs never credits anything -
      // there was no real cash at stake to return. Only on a WIN is
      // whether the stake itself comes back alongside net winnings a
      // per-brand choice (Brand.freebetStakeReturnedOnWin); either way the
      // credited amount lands in the player's cash balance below, never
      // back into their freebets balance.
      let newCredited = insuredCredited;
      if (updatedBet.fundedByFreebets) {
        if (outcome.overallStatus !== 'WON') {
          newCredited = 0;
        } else {
          const brand = await tx.brand.findUniqueOrThrow({ where: { id: brandId } });
          newCredited = brand.freebetStakeReturnedOnWin
            ? insuredCredited
            : Math.max(0, insuredCredited - updatedBet.stakeCents);
        }
      }
      const delta = newCredited - previousCredited;

      if (delta !== 0) {
        await tx.user.update({
          where: { id: updatedBet.userId },
          data: { balanceCents: { increment: delta } },
        });
      }

      return tx.bet.update({
        where: { id: betId },
        data: {
          status: outcome.overallStatus,
          settledPayoutCents: outcome.overallStatus === 'PENDING' ? null : newCredited,
          settledAt: outcome.overallStatus === 'PENDING' ? null : new Date(),
        },
        include: { selections: true },
      });
    });
  }
}

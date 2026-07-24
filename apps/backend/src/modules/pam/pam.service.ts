import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BetStatus, FreebetGrant, SelectionStatus } from '@prisma/client';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AccaBoostService } from '../acca-boost/acca-boost.service';
import { calculateAccaBoost } from '../acca-boost/acca-boost';
import { AccaRollbackService } from '../acca-rollback/acca-rollback.service';
import { calculateAccaRollbackReward } from '../acca-rollback/acca-rollback';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { BoostService } from '../boosts/boost.service';
import { FreebetService } from '../freebets/freebet.service';
import { InsuranceBetService } from '../insurance-bet/insurance-bet.service';
import { calculateInsuredPayout } from '../insurance-bet/insurance-bet';
import { resolveBetLimit, type LegContext, type PlayerExposure } from '../limits/stake-limits';
import { ManualMarketService } from '../manual-markets/manual-market.service';
import { OddsEngineClient } from '../margins/odds-engine-client';
import { computeBetOutcome } from './bet-settlement';
import { CompetitionSuspensionService } from './competition-suspension.service';
import type { PlaceBetDto } from './dto/place-bet.dto';
import { MarketSuspensionService } from './market-suspension.service';

function formatEuros(cents: number): string {
  return (cents / 100).toFixed(2);
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
  private async fetchMatchesByMatchId(dto: PlaceBetDto): Promise<Map<string, Match>> {
    const uniqueMatchIds = [...new Set(dto.selections.map((selection) => selection.matchId))];
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
   * Resolves each leg's own max stake/liability (see resolveBetLimit -
   * an accumulator's effective cap is the smallest one across its legs)
   * and rejects the bet if it exceeds either. A brand with no StakeLimit
   * rows at all skips the DB round-trip entirely - most brands never
   * configure this, same "nothing fabricated" pattern the rest of the
   * trading tools use.
   */
  private async assertWithinStakeLimits(
    userId: string,
    brandId: string,
    dto: PlaceBetDto,
    matchesById: Map<string, Match>,
    potentialPayoutCents: number,
  ): Promise<void> {
    const limitRows = await this.prisma.stakeLimit.findMany({ where: { brandId } });
    if (limitRows.length === 0) {
      return;
    }

    const tiers = await this.prisma.competitionTier.findMany({ where: { brandId } });
    const tierByCompetition = new Map(tiers.map((row) => [row.competition, row.tier]));

    const legs: LegContext[] = dto.selections.map((selection) => {
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
    const player = limitRows.some((row) => row.scope === 'PLAYER' && row.scopeValue === userId)
      ? await this.buildPlayerExposure(userId)
      : undefined;

    const limit = resolveBetLimit(limitRows, legs, player);
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

    return toRecord;
  }

  async placeBet(userId: string, dto: PlaceBetDto) {
    const { brandId } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { brandId: true },
    });
    const matchesById = await this.fetchMatchesByMatchId(dto);
    await this.assertNoCompetitionSuspended(brandId, matchesById);

    // A freebet is atomic - the stake must equal the grant's own value
    // exactly, not a partial amount - and never combines with acca boost,
    // to avoid double-bonusing the same bet (same rule will apply once
    // acca rollback/insurance bet are wired in).
    let freebetGrant: FreebetGrant | null = null;
    if (dto.freebetGrantId) {
      const active = await this.freebetService.listActive(userId, brandId);
      freebetGrant = active.find((grant) => grant.id === dto.freebetGrantId) ?? null;
      if (!freebetGrant) {
        throw new BadRequestException('Freebet not found or no longer active');
      }
      if (freebetGrant.amountCents !== dto.stakeCents) {
        throw new BadRequestException(
          `Stake must equal the freebet's value (€${formatEuros(freebetGrant.amountCents)})`,
        );
      }
    }

    const accaBoostConfig = await this.accaBoostService.getConfig(brandId);
    const rawBoost = calculateAccaBoost(
      dto.selections.map((selection) => selection.odds),
      accaBoostConfig,
    );
    const boost = freebetGrant
      ? { boostedCombinedOdds: rawBoost.baseCombinedOdds, boostPercent: 0 }
      : rawBoost;
    const combinedOdds = boost.boostedCombinedOdds;
    const rawPotentialPayoutCents = Math.round(dto.stakeCents * combinedOdds);

    // Insurance is priced per-bet (no minimum leg count) and, like acca
    // boost, never applies on a freebet-funded bet - the premium would
    // reduce a payout the player never paid cash for in the first place.
    const insuranceBetConfig = await this.insuranceBetService.getConfig(brandId);
    const insurancePricing = calculateInsuredPayout(
      rawPotentialPayoutCents,
      Boolean(dto.insuranceOptIn) && !freebetGrant,
      insuranceBetConfig,
    );
    const potentialPayoutCents = insurancePricing.insuredPayoutCents;

    await this.assertWithinStakeLimits(userId, brandId, dto, matchesById, potentialPayoutCents);
    const manualMarketLiabilityToRecord = await this.assertWithinManualMarketLimitsAndCollectLiability(
      brandId,
      dto,
      matchesById,
    );
    const boostLiabilityToRecord = await this.assertWithinBoostLimitsAndCollectLiability(brandId, dto, matchesById);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!freebetGrant && user.balanceCents < dto.stakeCents) {
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

      if (!freebetGrant) {
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
          freebetGrantId: freebetGrant?.id,
          selections: {
            create: dto.selections.map((selection) => ({
              matchId: selection.matchId,
              marketId: selection.marketId,
              selectionId: selection.selectionId,
              matchLabel: selection.matchLabel,
              marketName: selection.marketName,
              selectionName: selection.selectionName,
              odds: selection.odds,
            })),
          },
        },
        include: { selections: true },
      });

      if (freebetGrant) {
        await this.freebetService.spend(freebetGrant.id, userId, bet.id, tx);
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

      return bet;
    });
  }

  async getBets(userId: string) {
    return this.prisma.bet.findMany({
      where: { userId },
      include: { selections: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin-only: lists bets across all users in one brand, for manual settlement. */
  async listBetsForSettlement(brandId: string, status?: BetStatus) {
    return this.prisma.bet.findMany({
      where: { brandId, ...(status ? { status } : {}) },
      include: {
        selections: true,
        user: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
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
      // (how many legs actually lost) are in. Freebet-funded bets never
      // qualify either - refunding a reward on top of a bet that was
      // already a reward is the same double-bonusing acca boost avoids.
      const allLegsTerminal = updatedBet.selections.every((selection) => selection.status !== 'OPEN');
      if (outcome.overallStatus === 'LOST' && allLegsTerminal && updatedBet.freebetGrantId === null) {
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
      // A freebet-funded bet never returns its stake, even on a win or a
      // full void (see FreebetGrant) - only whatever's left after the
      // stake is real cash the player actually receives.
      const newCredited =
        updatedBet.freebetGrantId !== null
          ? Math.max(0, insuredCredited - updatedBet.stakeCents)
          : insuredCredited;
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

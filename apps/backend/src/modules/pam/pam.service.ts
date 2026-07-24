import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BetStatus, SelectionStatus } from '@prisma/client';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AccaBoostService } from '../acca-boost/acca-boost.service';
import { calculateAccaBoost } from '../acca-boost/acca-boost';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { resolveBetLimit, type LegContext } from '../limits/stake-limits';
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
    private readonly manualMarketService: ManualMarketService,
  ) {}

  async getWallet(userId: string): Promise<{ balanceCents: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { balanceCents: user.balanceCents };
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

    const limit = resolveBetLimit(limitRows, legs);
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
  ): Promise<{ marketId: string; liabilityCents: number }[]> {
    const toRecord: { marketId: string; liabilityCents: number }[] = [];

    for (const selection of dto.selections) {
      const market = await this.manualMarketService.findForBet(brandId, selection.marketId);
      if (!market) {
        continue;
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

  async placeBet(userId: string, dto: PlaceBetDto) {
    const { brandId } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { brandId: true },
    });
    const matchesById = await this.fetchMatchesByMatchId(dto);
    await this.assertNoCompetitionSuspended(brandId, matchesById);

    const accaBoostConfig = await this.accaBoostService.getConfig(brandId);
    const boost = calculateAccaBoost(
      dto.selections.map((selection) => selection.odds),
      accaBoostConfig,
    );
    const combinedOdds = boost.boostedCombinedOdds;
    const potentialPayoutCents = Math.round(dto.stakeCents * combinedOdds);

    await this.assertWithinStakeLimits(brandId, dto, matchesById, potentialPayoutCents);
    const manualMarketLiabilityToRecord = await this.assertWithinManualMarketLimitsAndCollectLiability(
      brandId,
      dto,
    );

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.balanceCents < dto.stakeCents) {
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

      await tx.user.update({
        where: { id: userId },
        data: { balanceCents: { decrement: dto.stakeCents } },
      });

      const bet = await tx.bet.create({
        data: {
          userId,
          brandId: user.brandId,
          stakeCents: dto.stakeCents,
          combinedOdds,
          potentialPayoutCents,
          accaBoostPercent: boost.boostPercent,
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

      for (const { marketId, liabilityCents } of manualMarketLiabilityToRecord) {
        await tx.manualMarket.update({
          where: { id: marketId },
          data: { currentLiabilityCents: { increment: liabilityCents } },
        });
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

      const previousCredited = updatedBet.settledPayoutCents ?? 0;
      const newCredited = outcome.overallStatus === 'PENDING' ? 0 : outcome.payoutCents;
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
          settledPayoutCents: outcome.overallStatus === 'PENDING' ? null : outcome.payoutCents,
          settledAt: outcome.overallStatus === 'PENDING' ? null : new Date(),
        },
        include: { selections: true },
      });
    });
  }
}

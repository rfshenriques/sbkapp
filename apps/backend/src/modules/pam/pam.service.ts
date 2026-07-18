import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BetStatus, SelectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { computeBetOutcome } from './bet-settlement';
import type { PlaceBetDto } from './dto/place-bet.dto';
import { MarketSuspensionService } from './market-suspension.service';

@Injectable()
export class PamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly marketSuspensionService: MarketSuspensionService,
  ) {}

  async getWallet(userId: string): Promise<{ balanceCents: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { balanceCents: user.balanceCents };
  }

  async placeBet(userId: string, dto: PlaceBetDto) {
    const combinedOdds = dto.selections.reduce((total, selection) => total * selection.odds, 1);
    const potentialPayoutCents = Math.round(dto.stakeCents * combinedOdds);

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

      return tx.bet.create({
        data: {
          userId,
          brandId: user.brandId,
          stakeCents: dto.stakeCents,
          combinedOdds,
          potentialPayoutCents,
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

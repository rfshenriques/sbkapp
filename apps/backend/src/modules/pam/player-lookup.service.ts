import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FreebetService } from '../freebets/freebet.service';
import { PlayerSegmentService } from '../player-segments/player-segment.service';

const RECENT_BETS_LIMIT = 20;
const RECENT_DEPOSITS_LIMIT = 20;
const SEARCH_RESULTS_LIMIT = 50;
const SETTLED_STATUSES = ['WON', 'LOST', 'VOID'] as const;

export interface PlayerSummary {
  id: string;
  email: string;
  username: string;
  phone: string;
  balanceCents: number;
  createdAt: Date;
}

export interface PlayerStats {
  /** Sum of stakeCents across every bet ever placed, settled or not. */
  turnoverCents: number;
  betCount: number;
  avgStakeCents: number;
  /** Stakes minus payouts across settled (WON/LOST/VOID) bets only - a VOID nets to ~0 since its payout refunds the stake. */
  ggrCents: number;
  /** Sum of (potentialPayoutCents - stakeCents) across this player's still-PENDING bets - what the house is currently exposed to lose if every open bet won. */
  openLiabilityCents: number;
  avgSelectionsPerBet: number;
  singleBetCount: number;
  accumulatorBetCount: number;
  topSports: { sport: string; count: number }[];
  topCompetitions: { competition: string; count: number }[];
}

/**
 * The read side of PAM's "account spine" (see docs/PROJECT_BRIEF.md Section
 * 8.5) for the backoffice's Players search/detail screens - pulls together
 * what's real today (profile, wallet, bets, freebets, segments, deposits,
 * device/push counts) and nothing that doesn't exist yet (no KYC/fraud
 * status, no cashier/payments history beyond deposit-campaign tracking -
 * those modules are still empty stubs, see PROJECT_BRIEF Section 10).
 */
@Injectable()
export class PlayerLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly freebetService: FreebetService,
    private readonly playerSegmentService: PlayerSegmentService,
  ) {}

  async search(brandId: string, query: string | undefined): Promise<PlayerSummary[]> {
    const trimmed = query?.trim();
    return this.prisma.user.findMany({
      where: {
        brandId,
        ...(trimmed
          ? {
              OR: [
                { email: { contains: trimmed, mode: 'insensitive' } },
                { username: { contains: trimmed, mode: 'insensitive' } },
                { phone: { contains: trimmed, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: SEARCH_RESULTS_LIMIT,
      select: { id: true, email: true, username: true, phone: true, balanceCents: true, createdAt: true },
    });
  }

  async getDetail(brandId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, brandId } });
    if (!user) return null;

    const [freebetsCents, segmentIds, recentBets, deposits, webauthnCredentialCount, pushSubscriptionCount, stats] =
      await Promise.all([
        this.freebetService.balanceCents(userId, brandId),
        this.playerSegmentService.resolveSegmentIdsForUser(userId),
        this.prisma.bet.findMany({
          where: { userId, brandId },
          orderBy: { createdAt: 'desc' },
          take: RECENT_BETS_LIMIT,
          include: {
            selections: { select: { matchLabel: true, marketName: true, selectionName: true, odds: true, status: true } },
            betAndGetCampaign: { select: { name: true } },
            depositCampaignRedemption: { include: { depositCampaign: { select: { name: true } } } },
          },
        }),
        this.prisma.deposit.findMany({
          where: { userId, brandId },
          orderBy: { createdAt: 'desc' },
          take: RECENT_DEPOSITS_LIMIT,
        }),
        this.prisma.webAuthnCredential.count({ where: { userId } }),
        this.prisma.pushSubscription.count({ where: { userId } }),
        this.computeStats(brandId, userId),
      ]);

    const segments = segmentIds.length
      ? await this.prisma.playerSegment.findMany({
          where: { id: { in: segmentIds } },
          select: { id: true, name: true, colorHex: true },
        })
      : [];

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      phone: user.phone,
      phoneVerifiedAt: user.phoneVerifiedAt,
      createdAt: user.createdAt,
      balanceCents: user.balanceCents,
      freebetsCents,
      segments,
      stats,
      recentBets: recentBets.map((bet) => ({
        id: bet.id,
        stakeCents: bet.stakeCents,
        combinedOdds: bet.combinedOdds,
        potentialPayoutCents: bet.potentialPayoutCents,
        settledPayoutCents: bet.settledPayoutCents,
        status: bet.status,
        createdAt: bet.createdAt,
        fundedByFreebets: bet.fundedByFreebets,
        insuranceCostPercent: bet.insuranceCostPercent,
        accaBoostPercent: bet.accaBoostPercent,
        campaignName: bet.betAndGetCampaign?.name ?? bet.depositCampaignRedemption?.depositCampaign.name ?? null,
        selections: bet.selections,
      })),
      deposits,
      webauthnCredentialCount,
      pushSubscriptionCount,
    };
  }

  private async computeStats(brandId: string, userId: string): Promise<PlayerStats> {
    const [turnover, settled, pending, betsWithSelectionCounts, sportRows, competitionRows] = await Promise.all([
      this.prisma.bet.aggregate({
        where: { userId, brandId },
        _sum: { stakeCents: true },
        _avg: { stakeCents: true },
        _count: true,
      }),
      this.prisma.bet.aggregate({
        where: { userId, brandId, status: { in: [...SETTLED_STATUSES] } },
        _sum: { stakeCents: true, settledPayoutCents: true },
      }),
      this.prisma.bet.aggregate({
        where: { userId, brandId, status: 'PENDING' },
        _sum: { stakeCents: true, potentialPayoutCents: true },
      }),
      this.prisma.bet.findMany({
        where: { userId, brandId },
        select: { _count: { select: { selections: true } } },
      }),
      this.prisma.betSelection.groupBy({
        by: ['sport'],
        where: { bet: { userId, brandId }, sport: { not: null } },
        _count: true,
      }),
      this.prisma.betSelection.groupBy({
        by: ['competition'],
        where: { bet: { userId, brandId }, competition: { not: null } },
        _count: true,
      }),
    ]);

    const betCount = turnover._count;
    const totalSelections = betsWithSelectionCounts.reduce((sum, bet) => sum + bet._count.selections, 0);
    const singleBetCount = betsWithSelectionCounts.filter((bet) => bet._count.selections === 1).length;

    return {
      turnoverCents: turnover._sum.stakeCents ?? 0,
      betCount,
      avgStakeCents: betCount > 0 ? Math.round(turnover._avg.stakeCents ?? 0) : 0,
      ggrCents: (settled._sum.stakeCents ?? 0) - (settled._sum.settledPayoutCents ?? 0),
      openLiabilityCents: (pending._sum.potentialPayoutCents ?? 0) - (pending._sum.stakeCents ?? 0),
      avgSelectionsPerBet: betCount > 0 ? totalSelections / betCount : 0,
      singleBetCount,
      accumulatorBetCount: betCount - singleBetCount,
      topSports: sportRows
        .map((row) => ({ sport: row.sport!, count: row._count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topCompetitions: competitionRows
        .map((row) => ({ competition: row.competition!, count: row._count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }
}

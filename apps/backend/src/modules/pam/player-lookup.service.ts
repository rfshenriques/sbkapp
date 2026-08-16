import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FreebetService } from '../freebets/freebet.service';
import { PlayerSegmentService } from '../player-segments/player-segment.service';

const RECENT_BETS_LIMIT = 20;
const RECENT_DEPOSITS_LIMIT = 20;
const SEARCH_RESULTS_LIMIT = 50;

export interface PlayerSummary {
  id: string;
  email: string;
  username: string;
  phone: string;
  balanceCents: number;
  createdAt: Date;
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

    const [freebetsCents, segmentIds, recentBets, deposits, webauthnCredentialCount, pushSubscriptionCount] =
      await Promise.all([
        this.freebetService.balanceCents(userId, brandId),
        this.playerSegmentService.resolveSegmentIdsForUser(userId),
        this.prisma.bet.findMany({
          where: { userId, brandId },
          orderBy: { createdAt: 'desc' },
          take: RECENT_BETS_LIMIT,
          include: { selections: { select: { matchLabel: true, marketName: true, selectionName: true, status: true } } },
        }),
        this.prisma.deposit.findMany({
          where: { userId, brandId },
          orderBy: { createdAt: 'desc' },
          take: RECENT_DEPOSITS_LIMIT,
        }),
        this.prisma.webAuthnCredential.count({ where: { userId } }),
        this.prisma.pushSubscription.count({ where: { userId } }),
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
      recentBets,
      deposits,
      webauthnCredentialCount,
      pushSubscriptionCount,
    };
  }
}

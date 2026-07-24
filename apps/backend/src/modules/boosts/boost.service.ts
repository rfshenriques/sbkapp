import { Injectable, NotFoundException } from '@nestjs/common';
import type { AudienceMode, Prisma } from '@prisma/client';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { ANONYMOUS_VIEWER, resolveAudience, type AudienceViewer } from '../audience/audience';
import { applyBoostToPrice } from './odds-ladder';
import { OddsLadderService } from './odds-ladder.service';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

function boostKey(matchId: string, marketId: string, selectionId: string): string {
  return `${matchId}:${marketId}:${selectionId}`;
}

export interface SetBoostLimitsInput {
  maxStakeCents?: number | null;
  maxLiabilityCents?: number | null;
  audienceMode?: AudienceMode;
  segmentIds?: string[];
  staysLiveDuringInplay?: boolean;
}

/**
 * A trader-configured price boost: instead of a fixed price (see
 * OddsOverride), this climbs a selection N rungs up the brand's odds
 * ladder from whatever price it would otherwise show - applied as the very
 * last step of the public matches pricing pipeline, after margin, manual
 * markets, and odds overrides.
 */
@Injectable()
export class BoostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly oddsLadderService: OddsLadderService,
  ) {}

  /** Idempotent - re-setting an already-boosted selection updates its ticks/reason in place. This is how a trader edits a boost: set it again with the new tick count. */
  async setBoost(
    brandId: string,
    matchId: string,
    marketId: string,
    selectionId: string,
    ticks: number,
    reason: string | undefined,
    actor: AuditActor,
  ) {
    const boost = await this.prisma.boost.upsert({
      where: { brandId_matchId_marketId_selectionId: { brandId, matchId, marketId, selectionId } },
      create: { brandId, matchId, marketId, selectionId, ticks, reason },
      update: { ticks, reason },
    });

    await this.auditLogService.record({
      actor,
      action: 'BOOST_SET',
      targetType: 'Selection',
      targetId: boostKey(matchId, marketId, selectionId),
      metadata: { matchId, marketId, selectionId, ticks, reason: reason ?? null },
    });

    return boost;
  }

  /** `brandId` must match the boost's own brand - a staff member can never clear another brand's boost, even by guessing its id. */
  async clearBoost(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.boost.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Boost not found');
    }

    const boost = await this.prisma.boost.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'BOOST_CLEARED',
      targetType: 'Selection',
      targetId: boostKey(boost.matchId, boost.marketId, boost.selectionId),
      metadata: { matchId: boost.matchId, marketId: boost.marketId, selectionId: boost.selectionId },
    });

    return boost;
  }

  async listBoosts(brandId: string) {
    return this.prisma.boost.findMany({
      where: { brandId },
      include: { audienceSegments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Replaces stake/liability caps and/or audience targeting in one write -
   * a separate endpoint from setBoost so a trader adjusting a limit
   * doesn't have to resend ticks/reason. Only the fields present in
   * `input` change; omit a field to leave it as-is.
   */
  async setLimits(brandId: string, id: string, input: SetBoostLimitsInput, actor: AuditActor) {
    const existing = await this.prisma.boost.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Boost not found');
    }

    const boost = await this.prisma.boost.update({
      where: { id },
      data: {
        ...(input.maxStakeCents !== undefined ? { maxStakeCents: input.maxStakeCents } : {}),
        ...(input.maxLiabilityCents !== undefined ? { maxLiabilityCents: input.maxLiabilityCents } : {}),
        ...(input.audienceMode !== undefined ? { audienceMode: input.audienceMode } : {}),
        ...(input.segmentIds !== undefined
          ? {
              audienceSegments: {
                deleteMany: {},
                create: input.segmentIds.map((segmentId) => ({ segmentId })),
              },
            }
          : {}),
        ...(input.staysLiveDuringInplay !== undefined
          ? { staysLiveDuringInplay: input.staysLiveDuringInplay }
          : {}),
      },
      include: { audienceSegments: true },
    });

    await this.auditLogService.record({
      actor,
      action: 'BOOST_LIMITS_SET',
      targetType: 'Selection',
      targetId: boostKey(boost.matchId, boost.marketId, boost.selectionId),
      metadata: { ...input },
    });

    return boost;
  }

  /** Used by PamService at bet placement to check stake/liability caps and record exposure - a live (non-disabled) boost only. */
  async findActiveForBet(brandId: string, matchId: string, marketId: string, selectionId: string) {
    const boost = await this.prisma.boost.findUnique({
      where: { brandId_matchId_marketId_selectionId: { brandId, matchId, marketId, selectionId } },
    });
    return boost && boost.disabledAt === null ? boost : null;
  }

  /**
   * Adds to the boost's running exposure after a bet is accepted, then
   * auto-disables it if that pushes currentLiabilityCents past
   * maxLiabilityCents - the boost stops applying to future bets from that
   * point on, same as if a trader had cleared it, but the row (and its
   * exposure history) stays. Accepts an optional transaction client so
   * PamService can run this atomically alongside the bet it belongs to.
   */
  async recordLiabilityAndMaybeDisable(
    id: string,
    liabilityCents: number,
    actor: AuditActor,
    client: PrismaClientLike = this.prisma,
  ) {
    const boost = await client.boost.update({
      where: { id },
      data: { currentLiabilityCents: { increment: liabilityCents } },
    });

    if (boost.maxLiabilityCents !== null && boost.currentLiabilityCents >= boost.maxLiabilityCents) {
      const disabled = await client.boost.update({
        where: { id },
        data: { disabledAt: new Date() },
      });
      await this.auditLogService.record(
        {
          actor,
          action: 'BOOST_AUTO_DISABLED',
          targetType: 'Selection',
          targetId: boostKey(disabled.matchId, disabled.marketId, disabled.selectionId),
          metadata: {
            currentLiabilityCents: disabled.currentLiabilityCents,
            maxLiabilityCents: disabled.maxLiabilityCents,
          },
        },
        client,
      );
    }
  }

  /**
   * Applies each boost as the very last pricing step: takes whatever price
   * a selection would otherwise show (margin + manual markets + overrides
   * already applied), climbs it up the brand's odds ladder, and records
   * the pre-boost price as originalOdds so the player UI can show both.
   * A disabled boost (liability cap hit), one this viewer's audience
   * doesn't cover, or one whose match has gone in-play without
   * staysLiveDuringInplay set (a boosted price has no live re-pricing
   * behind it) is skipped entirely, same as if it never existed. Matches
   * with no boosted selection pass through unchanged.
   */
  async applyBoosts(brandId: string, matches: Match[], viewer: AudienceViewer = ANONYMOUS_VIEWER): Promise<Match[]> {
    const boosts = await this.prisma.boost.findMany({
      where: { brandId, disabledAt: null },
      include: { audienceSegments: true },
    });
    const isLiveByMatchId = new Map(matches.map((match) => [match.id, match.isLive]));
    const visibleBoosts = boosts.filter(
      (boost) =>
        (boost.staysLiveDuringInplay || !isLiveByMatchId.get(boost.matchId)) &&
        resolveAudience(
          boost.audienceMode,
          boost.audienceSegments.map((segment) => segment.segmentId),
          viewer,
        ),
    );
    if (visibleBoosts.length === 0) {
      return matches;
    }
    const ladder = await this.oddsLadderService.listRungValues(brandId);
    const boostsByKey = new Map(
      visibleBoosts.map((boost) => [boostKey(boost.matchId, boost.marketId, boost.selectionId), boost]),
    );

    return matches.map((match) => ({
      ...match,
      markets: match.markets.map((market) => ({
        ...market,
        selections: market.selections.map((selection) => {
          const boost = boostsByKey.get(boostKey(match.id, market.id, selection.id));
          if (!boost) {
            return selection;
          }
          const boostedOdds = applyBoostToPrice(ladder, selection.odds, boost.ticks);
          if (boostedOdds === selection.odds) {
            // No ladder configured (or already at the top rung) - nothing actually changed, so don't claim a boost happened.
            return selection;
          }
          return {
            ...selection,
            odds: boostedOdds,
            originalOdds: selection.odds,
            ...(boost.maxStakeCents !== null ? { maxStakeCents: boost.maxStakeCents } : {}),
          };
        }),
      })),
    }));
  }
}

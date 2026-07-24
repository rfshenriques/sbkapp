import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FreebetSource, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

/** Accepts either the module-level PrismaService or a $transaction callback's client, so PamService can spend a freebet atomically alongside placing the bet it funds. */
type PrismaClientLike = PrismaService | Prisma.TransactionClient;

export interface GrantFreebetInput {
  /** Email or username, scoped to the acting staff member's own brand - same lookup PlayerSegmentService uses. */
  identifier: string;
  amountCents: number;
  note?: string;
  expiresAt?: Date;
}

export interface SystemGrantFreebetInput {
  userId: string;
  brandId: string;
  amountCents: number;
  /** Never MANUAL - that source is staff-initiated via grant(). */
  source: Exclude<FreebetSource, 'MANUAL'>;
  /** The bet that triggered this reward, e.g. the losing accumulator an ACCA_ROLLBACK refunds - also the idempotency key callers should check via findBySourceBet before granting. */
  sourceBetId: string;
  /** Only meaningful for BET_AND_GET - which campaign granted this, so BetAndGetCampaignService can count a player's redemptions of that specific campaign. */
  sourceCampaignId?: string;
}

/**
 * A freebet is a single-use, stake-not-returned token - atomic (a bet
 * funded by one must stake exactly its amountCents), same as how real
 * sportsbook free bets work. `status` only ever changes via an explicit
 * actor action (spend on bet placement, void by staff); expiry is a
 * read-time condition on expiresAt, not a swept status.
 */
@Injectable()
export class FreebetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async grant(brandId: string, input: GrantFreebetInput, actor: AuditActor) {
    if (input.amountCents <= 0) {
      throw new BadRequestException('amountCents must be positive');
    }

    const user = await this.prisma.user.findFirst({
      where: { brandId, OR: [{ email: input.identifier }, { username: input.identifier }] },
      select: { id: true, username: true },
    });
    if (!user) {
      throw new NotFoundException('No player found with that email or username in this brand');
    }

    const grant = await this.prisma.freebetGrant.create({
      data: {
        userId: user.id,
        brandId,
        amountCents: input.amountCents,
        source: 'MANUAL',
        note: input.note,
        expiresAt: input.expiresAt,
        createdByStaffUserId: actor.id,
        createdByUsername: actor.username,
      },
    });

    await this.auditLogService.record({
      actor,
      action: 'FREEBET_GRANTED',
      targetType: 'FreebetGrant',
      targetId: grant.id,
      metadata: { username: user.username, amountCents: input.amountCents, source: 'MANUAL' },
    });

    return grant;
  }

  /**
   * A system-triggered reward (acca rollback, insurance bet) rather than a
   * staff-initiated one - no actor to attribute it to, so it's logged under
   * a `system:<source>` audit actor instead. Idempotent on (sourceBetId,
   * source): a bet whose settlement is corrected and re-evaluated must
   * never be granted the same reward twice, so a second call with the same
   * pair just returns the grant already created by the first.
   */
  async grantSystem(input: SystemGrantFreebetInput, client: PrismaClientLike = this.prisma) {
    const existing = await client.freebetGrant.findFirst({
      where: { sourceBetId: input.sourceBetId, source: input.source },
    });
    if (existing) {
      return existing;
    }

    const grant = await client.freebetGrant.create({
      data: {
        userId: input.userId,
        brandId: input.brandId,
        amountCents: input.amountCents,
        source: input.source,
        sourceBetId: input.sourceBetId,
        sourceCampaignId: input.sourceCampaignId,
      },
    });

    await this.auditLogService.record(
      {
        actor: { id: 'system', username: `system:${input.source.toLowerCase()}`, brandId: input.brandId },
        action: 'FREEBET_GRANTED',
        targetType: 'FreebetGrant',
        targetId: grant.id,
        metadata: {
          amountCents: input.amountCents,
          source: input.source,
          sourceBetId: input.sourceBetId,
          sourceCampaignId: input.sourceCampaignId,
        },
      },
      client,
    );

    return grant;
  }

  /** Every grant (any status) for a player, newest first - backs the backoffice lookup page. `brandId` scopes so a staff member can never look up another brand's player. */
  async list(brandId: string, identifier: string) {
    const user = await this.prisma.user.findFirst({
      where: { brandId, OR: [{ email: identifier }, { username: identifier }] },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('No player found with that email or username in this brand');
    }

    return this.prisma.freebetGrant.findMany({
      where: { userId: user.id, brandId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** ACTIVE, unexpired grants only - what a player can actually fund a bet with right now. */
  async listActive(userId: string, brandId: string) {
    return this.prisma.freebetGrant.findMany({
      where: {
        userId,
        brandId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Sum of active/unexpired grants - only what gates the bet slip's Cash/Freebets toggle visibility, never used to fund a bet directly (see spend, which is per-grant and atomic). */
  async balanceCents(userId: string, brandId: string): Promise<number> {
    const active = await this.listActive(userId, brandId);
    return active.reduce((total, grant) => total + grant.amountCents, 0);
  }

  /**
   * Marks one specific grant SPENT, tied to the bet it funded. The caller
   * (PamService.placeBet) is responsible for checking the bet's stake
   * equals grant.amountCents before calling this - this method only
   * enforces ownership/status/expiry, not the stake match, since it has no
   * bet-shape knowledge of its own.
   */
  async spend(grantId: string, userId: string, betId: string, client: PrismaClientLike = this.prisma) {
    const grant = await client.freebetGrant.findUnique({ where: { id: grantId } });
    if (!grant || grant.userId !== userId) {
      throw new NotFoundException('Freebet not found');
    }
    if (grant.status !== 'ACTIVE') {
      throw new BadRequestException('This freebet is no longer active');
    }
    if (grant.expiresAt && grant.expiresAt <= new Date()) {
      throw new BadRequestException('This freebet has expired');
    }

    return client.freebetGrant.update({
      where: { id: grantId },
      data: { status: 'SPENT', spentAt: new Date(), spentOnBetId: betId },
    });
  }

  /** Staff revokes an ACTIVE grant before it's used - `brandId` scopes so a staff member can never void another brand's grant. */
  async void(brandId: string, grantId: string, actor: AuditActor) {
    const grant = await this.prisma.freebetGrant.findUnique({ where: { id: grantId } });
    if (!grant || grant.brandId !== brandId) {
      throw new NotFoundException('Freebet not found');
    }
    if (grant.status !== 'ACTIVE') {
      throw new BadRequestException('Only an active freebet can be voided');
    }

    const voided = await this.prisma.freebetGrant.update({
      where: { id: grantId },
      data: { status: 'VOIDED', voidedAt: new Date() },
    });

    await this.auditLogService.record({
      actor,
      action: 'FREEBET_VOIDED',
      targetType: 'FreebetGrant',
      targetId: grant.id,
      metadata: { amountCents: grant.amountCents },
    });

    return voided;
  }
}

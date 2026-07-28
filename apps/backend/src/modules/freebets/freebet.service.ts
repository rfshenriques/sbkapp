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
  /**
   * The bet that triggered this reward, e.g. the losing accumulator an
   * ACCA_ROLLBACK refunds - also the idempotency key this method checks
   * before granting (re-settling the same bet never double-grants). Omit
   * only for a reward with no triggering bet at all (e.g. a DEPOSIT_CAMPAIGN
   * grant that doesn't require a bet) - the dedup check is skipped in that
   * case, so the caller is responsible for its own idempotency.
   */
  sourceBetId?: string;
  /** Only meaningful for BET_AND_GET and DEPOSIT_CAMPAIGN - which campaign granted this, so its service can count a player's redemptions against maxRedemptionsPerPlayer. */
  sourceCampaignId?: string;
}

/**
 * A freebet grant credits the player's pooled freebets balance - a second
 * wallet a bet can draw any typed stake from (see spendFromBalance), not a
 * single fixed-value token. Whether a winning bet's stake is credited back
 * on top of net winnings is a per-brand choice (see
 * Brand.freebetStakeReturnedOnWin / PamService.settleSelection), not
 * something this service decides. `status` flips to
 * SPENT once a grant's `remainingCents` is fully drawn down, or VOIDED via
 * an explicit staff action; expiry is a read-time condition on expiresAt,
 * not a swept status.
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
        remainingCents: input.amountCents,
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
   * source) whenever sourceBetId is given: a bet whose settlement is
   * corrected and re-evaluated must never be granted the same reward twice,
   * so a second call with the same pair just returns the grant already
   * created by the first. Skipped entirely when sourceBetId is omitted -
   * the caller (e.g. a no-bet-required deposit campaign) owns its own
   * idempotency in that case.
   */
  async grantSystem(input: SystemGrantFreebetInput, client: PrismaClientLike = this.prisma) {
    if (input.sourceBetId) {
      const existing = await client.freebetGrant.findFirst({
        where: { sourceBetId: input.sourceBetId, source: input.source },
      });
      if (existing) {
        return existing;
      }
    }

    const grant = await client.freebetGrant.create({
      data: {
        userId: input.userId,
        brandId: input.brandId,
        amountCents: input.amountCents,
        remainingCents: input.amountCents,
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

  /** ACTIVE, unexpired, not-yet-fully-drawn-down grants only - what a player can actually fund a bet with right now, oldest-expiring first (the order spendFromBalance draws them down in). Each grant is annotated with the source campaign's name where applicable, for the player-facing "you were credited freebets from campaign Y" modal. */
  async listActive(userId: string, brandId: string) {
    const grants = await this.prisma.freebetGrant.findMany({
      where: {
        userId,
        brandId,
        status: 'ACTIVE',
        remainingCents: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    });
    const campaignNameById = await this.campaignNamesById(grants);
    return grants.map((grant) => ({
      ...grant,
      campaignName: grant.sourceCampaignId ? (campaignNameById.get(grant.sourceCampaignId) ?? null) : null,
    }));
  }

  /**
   * FreebetGrant.sourceCampaignId is a plain string, not a Prisma relation -
   * it points to either BetAndGetCampaign.id or DepositCampaign.id depending
   * on `source`, so the name has to be resolved with a manual batch lookup
   * rather than an include/select.
   */
  private async campaignNamesById(grants: { source: FreebetSource; sourceCampaignId: string | null }[]) {
    const betAndGetIds = grants
      .filter((grant) => grant.source === 'BET_AND_GET' && grant.sourceCampaignId)
      .map((grant) => grant.sourceCampaignId as string);
    const depositCampaignIds = grants
      .filter((grant) => grant.source === 'DEPOSIT_CAMPAIGN' && grant.sourceCampaignId)
      .map((grant) => grant.sourceCampaignId as string);

    const [betAndGetCampaigns, depositCampaigns] = await Promise.all([
      betAndGetIds.length
        ? this.prisma.betAndGetCampaign.findMany({ where: { id: { in: betAndGetIds } }, select: { id: true, name: true } })
        : [],
      depositCampaignIds.length
        ? this.prisma.depositCampaign.findMany({ where: { id: { in: depositCampaignIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const campaignNameById = new Map<string, string>();
    for (const campaign of [...betAndGetCampaigns, ...depositCampaigns]) {
      campaignNameById.set(campaign.id, campaign.name);
    }
    return campaignNameById;
  }

  /** Sum of active/unexpired grants' remaining balance - the pooled freebets wallet total a bet's typed stake can draw from (see spendFromBalance). */
  async balanceCents(userId: string, brandId: string): Promise<number> {
    const active = await this.listActive(userId, brandId);
    return active.reduce((total, grant) => total + grant.remainingCents, 0);
  }

  /**
   * Draws a freebet-mode bet's stake down from the player's pooled
   * balance, oldest-expiring grant first, potentially spanning several
   * grants for one bet (see BetFreebetDebit) - the freebets equivalent of
   * decrementing User.balanceCents for a cash bet. Throws if the pool
   * can't cover the full amount; the caller (PamService.placeBet) is
   * expected to have already confirmed balanceCents() >= amountCents, so
   * this only re-throws on a genuine race (e.g. a grant voided/expired
   * between the check and this call).
   */
  async spendFromBalance(
    userId: string,
    brandId: string,
    amountCents: number,
    betId: string,
    client: PrismaClientLike = this.prisma,
  ): Promise<void> {
    const grants = await client.freebetGrant.findMany({
      where: {
        userId,
        brandId,
        status: 'ACTIVE',
        remainingCents: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    });

    let remaining = amountCents;
    for (const grant of grants) {
      if (remaining <= 0) break;
      const debit = Math.min(grant.remainingCents, remaining);
      const nextRemainingCents = grant.remainingCents - debit;
      await client.freebetGrant.update({
        where: { id: grant.id },
        data: {
          remainingCents: nextRemainingCents,
          status: nextRemainingCents <= 0 ? 'SPENT' : 'ACTIVE',
          spentAt: nextRemainingCents <= 0 ? new Date() : grant.spentAt,
        },
      });
      await client.betFreebetDebit.create({
        data: { betId, freebetGrantId: grant.id, amountCents: debit },
      });
      remaining -= debit;
    }

    if (remaining > 0) {
      throw new BadRequestException('Insufficient freebets balance');
    }
  }

  /**
   * Grants (any status) the player hasn't yet been shown a freebet-credited
   * modal for - unlike listActive this deliberately ignores status/expiry,
   * since a grant that expired or was spent before the player ever saw it
   * still deserves the modal once. Queried once after login so a grant that
   * happened while the player wasn't logged in at all still gets shown, not
   * just one dropped by the frontend's same-session localStorage tracking.
   */
  async listUnseen(userId: string, brandId: string) {
    const grants = await this.prisma.freebetGrant.findMany({
      where: { userId, brandId, notifiedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const campaignNameById = await this.campaignNamesById(grants);
    return grants.map((grant) => ({
      ...grant,
      campaignName: grant.sourceCampaignId ? (campaignNameById.get(grant.sourceCampaignId) ?? null) : null,
    }));
  }

  /** Marks grants as shown to the player so they never resurface on a later login - `userId` scopes so a player can only acknowledge their own grants. */
  async acknowledge(userId: string, grantIds: string[]): Promise<void> {
    if (grantIds.length === 0) return;
    await this.prisma.freebetGrant.updateMany({
      where: { id: { in: grantIds }, userId },
      data: { notifiedAt: new Date() },
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

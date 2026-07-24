import { Injectable, NotFoundException } from '@nestjs/common';
import type { LimitScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

export interface StakeLimitValues {
  scope: LimitScope;
  scopeValue: string;
  tier: number;
  maxStakeCents: number | null;
  maxLiabilityCents: number | null;
}

@Injectable()
export class StakeLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(brandId: string) {
    return this.prisma.stakeLimit.findMany({
      where: { brandId },
      orderBy: [{ scope: 'asc' }, { scopeValue: 'asc' }, { tier: 'asc' }],
    });
  }

  /** Idempotent - setting a limit for an already-configured (scope, scopeValue, tier) triple just updates it. */
  async set(brandId: string, values: StakeLimitValues, actor: AuditActor) {
    const resolvedValues =
      values.scope === 'PLAYER' ? { ...values, scopeValue: await this.resolvePlayerId(brandId, values.scopeValue) } : values;

    const row = await this.prisma.stakeLimit.upsert({
      where: {
        brandId_scope_scopeValue_tier: {
          brandId,
          scope: resolvedValues.scope,
          scopeValue: resolvedValues.scopeValue,
          tier: resolvedValues.tier,
        },
      },
      create: { brandId, ...resolvedValues },
      update: {
        maxStakeCents: resolvedValues.maxStakeCents,
        maxLiabilityCents: resolvedValues.maxLiabilityCents,
      },
    });

    await this.auditLogService.record({
      actor,
      action: 'STAKE_LIMIT_SET',
      targetType: 'StakeLimit',
      targetId: row.id,
      metadata: { ...resolvedValues, playerIdentifier: values.scope === 'PLAYER' ? values.scopeValue : undefined },
    });

    return row;
  }

  /** Resolves a PLAYER-scope row's email/username input to that player's User.id, scoped to this brand - same lookup FreebetService.grant() uses. */
  private async resolvePlayerId(brandId: string, identifier: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { brandId, OR: [{ email: identifier }, { username: identifier }] },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('No player found with that email or username in this brand');
    }
    return user.id;
  }

  /** `brandId` must match the row's own brand - a staff member can never remove another brand's limit, even by guessing its id. */
  async remove(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.stakeLimit.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Stake limit not found');
    }

    const row = await this.prisma.stakeLimit.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'STAKE_LIMIT_REMOVED',
      targetType: 'StakeLimit',
      targetId: row.id,
      metadata: { scope: row.scope, scopeValue: row.scopeValue, tier: row.tier },
    });

    return row;
  }

  /**
   * Wholesale replace: the uploaded file is the new source of truth for
   * this brand's limits, not a set of patches - a row edited out of the
   * spreadsheet before re-upload is meant to disappear, not linger. Upserts
   * every row the file specifies and deletes every existing row it
   * doesn't, all in one transaction so a bulk import never leaves the
   * brand's limits half-old/half-new.
   */
  async bulkReplace(brandId: string, rows: StakeLimitValues[], actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const kept = await Promise.all(
        rows.map((values) =>
          tx.stakeLimit.upsert({
            where: {
              brandId_scope_scopeValue_tier: {
                brandId,
                scope: values.scope,
                scopeValue: values.scopeValue,
                tier: values.tier,
              },
            },
            create: { brandId, ...values },
            update: {
              maxStakeCents: values.maxStakeCents,
              maxLiabilityCents: values.maxLiabilityCents,
            },
          }),
        ),
      );

      const keptIds = kept.map((row) => row.id);
      const { count: removedCount } = await tx.stakeLimit.deleteMany({
        where: { brandId, id: { notIn: keptIds } },
      });

      await this.auditLogService.record(
        {
          actor,
          action: 'STAKE_LIMITS_BULK_IMPORTED',
          targetType: 'StakeLimit',
          targetId: brandId,
          metadata: { rowCount: rows.length, removedCount },
        },
        tx,
      );

      return { count: kept.length, removedCount };
    });
  }
}

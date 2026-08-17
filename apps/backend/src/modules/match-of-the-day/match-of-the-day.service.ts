import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { isCampaignScheduledActive } from '../bet-and-get/bet-and-get';

export interface MatchOfTheDayFields {
  matchId?: string;
  enabled?: boolean;
  startAt?: Date | null;
  endAt?: Date | null;
}

/**
 * CMS-managed "Match of the day" picks (see the backoffice's Match of the
 * day page) - staff choose which live match(es) to feature and, optionally,
 * a start/end window for how long the pick should show. Replaces the old
 * client-side "earliest kickoff with a match-result market" auto-pick
 * entirely - with nothing configured, apps/frontend shows no featured match
 * at all rather than fabricating one (see CLAUDE.md's "only build what's
 * backed by real data"). `matchId` is never validated against a local
 * table - matches live in the external odds-engine (see PromoCardService's
 * analogous BetAndGetCampaign scope handling) - a pick for a match that's
 * since kicked off/disappeared from the feed just silently stops rendering
 * on the frontend rather than erroring.
 */
@Injectable()
export class MatchOfTheDayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Every pick for this brand, active or not - staff need to see (and edit) scheduled/disabled ones too. */
  async list(brandId: string) {
    return this.prisma.matchOfTheDay.findMany({
      where: { brandId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Only the picks actually live right now, in display order - what apps/frontend renders. */
  async listActiveForViewer(brandId: string) {
    const entries = await this.list(brandId);
    const now = new Date();
    return entries.filter((entry) => isCampaignScheduledActive(entry, now));
  }

  async add(brandId: string, fields: Required<Pick<MatchOfTheDayFields, 'matchId'>> & MatchOfTheDayFields, actor: AuditActor) {
    const highest = await this.prisma.matchOfTheDay.findFirst({
      where: { brandId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const entry = await this.prisma.matchOfTheDay.create({
      data: {
        brandId,
        matchId: fields.matchId,
        enabled: fields.enabled ?? true,
        startAt: fields.startAt ?? null,
        endAt: fields.endAt ?? null,
        sortOrder: (highest?.sortOrder ?? -1) + 1,
      },
    });

    await this.auditLogService.record({
      actor,
      action: 'MATCH_OF_THE_DAY_ADDED',
      targetType: 'MatchOfTheDay',
      targetId: entry.id,
      metadata: { matchId: entry.matchId },
    });

    return entry;
  }

  /** `brandId` must match the entry's own brand - a staff member can never edit another brand's pick, even by guessing its id. */
  async update(brandId: string, id: string, fields: MatchOfTheDayFields, actor: AuditActor) {
    const existing = await this.prisma.matchOfTheDay.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Match of the day entry not found');
    }

    const entry = await this.prisma.matchOfTheDay.update({
      where: { id },
      data: fields,
    });

    await this.auditLogService.record({
      actor,
      action: 'MATCH_OF_THE_DAY_UPDATED',
      targetType: 'MatchOfTheDay',
      targetId: entry.id,
      metadata: { matchId: entry.matchId },
    });

    return entry;
  }

  async remove(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.matchOfTheDay.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Match of the day entry not found');
    }

    const entry = await this.prisma.matchOfTheDay.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'MATCH_OF_THE_DAY_REMOVED',
      targetType: 'MatchOfTheDay',
      targetId: entry.id,
      metadata: { matchId: entry.matchId },
    });

    return entry;
  }

  /** Every id must belong to this brand, and the full set must be provided - a partial reorder would leave the rest in an undefined relative order. */
  async reorder(brandId: string, orderedIds: string[], actor: AuditActor) {
    const existing = await this.prisma.matchOfTheDay.findMany({ where: { brandId }, select: { id: true } });
    const existingIds = new Set(existing.map((entry) => entry.id));

    if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
      throw new BadRequestException('ids must be exactly the current set of Match of the day entries for this brand');
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) => this.prisma.matchOfTheDay.update({ where: { id }, data: { sortOrder: index } })),
    );

    await this.auditLogService.record({
      actor,
      action: 'MATCH_OF_THE_DAY_REORDERED',
      targetType: 'MatchOfTheDay',
      targetId: brandId,
      metadata: { order: orderedIds },
    });

    return this.list(brandId);
  }
}

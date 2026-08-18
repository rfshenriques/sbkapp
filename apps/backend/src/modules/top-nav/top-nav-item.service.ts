import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TopNavItemKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

export interface TopNavItemFields {
  kind?: TopNavItemKind;
  label?: string;
  sport?: string | null;
  competition?: string | null;
  matchId?: string | null;
  enabled?: boolean;
}

/** Every kind carries exactly one of sport/competition/matchId - TODAY/TOMORROW carry none. */
function assertFieldMatchesKind(
  kind: TopNavItemKind,
  fields: Pick<TopNavItemFields, 'sport' | 'competition' | 'matchId'>,
) {
  if (kind === 'SPORT' && !fields.sport) {
    throw new BadRequestException('sport is required for a SPORT top nav item');
  }
  if (kind === 'COMPETITION' && !fields.competition) {
    throw new BadRequestException('competition is required for a COMPETITION top nav item');
  }
  if (kind === 'MATCH' && !fields.matchId) {
    throw new BadRequestException('matchId is required for a MATCH top nav item');
  }
}

/**
 * CMS-managed second navbar (see the backoffice's Top nav page) - staff
 * build it entry by entry from sports, competitions, specific matches, and
 * the two auto-updating timeframe shortcuts (Today/Tomorrow), in whatever
 * order they want. Same "no local match/competition table" reasoning as
 * MatchOfTheDayService - sport/competition/matchId are never validated
 * against a local table, they're just plugged into the player app's own
 * routing; a stale reference just stops matching anything on the frontend.
 */
@Injectable()
export class TopNavItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Every item for this brand, enabled or not - staff need to see (and edit) disabled ones too. */
  async list(brandId: string) {
    return this.prisma.topNavItem.findMany({
      where: { brandId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Only enabled items, in display order - what apps/frontend renders. */
  async listEnabled(brandId: string) {
    return this.prisma.topNavItem.findMany({
      where: { brandId, enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async add(
    brandId: string,
    fields: Required<Pick<TopNavItemFields, 'kind' | 'label'>> & TopNavItemFields,
    actor: AuditActor,
  ) {
    assertFieldMatchesKind(fields.kind, fields);

    const highest = await this.prisma.topNavItem.findFirst({
      where: { brandId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const entry = await this.prisma.topNavItem.create({
      data: {
        brandId,
        kind: fields.kind,
        label: fields.label,
        sport: fields.sport ?? null,
        competition: fields.competition ?? null,
        matchId: fields.matchId ?? null,
        enabled: fields.enabled ?? true,
        sortOrder: (highest?.sortOrder ?? -1) + 1,
      },
    });

    await this.auditLogService.record({
      actor,
      action: 'TOP_NAV_ITEM_ADDED',
      targetType: 'TopNavItem',
      targetId: entry.id,
      metadata: { kind: entry.kind, label: entry.label },
    });

    return entry;
  }

  /** `brandId` must match the entry's own brand - a staff member can never edit another brand's item, even by guessing its id. */
  async update(brandId: string, id: string, fields: TopNavItemFields, actor: AuditActor) {
    const existing = await this.prisma.topNavItem.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Top nav item not found');
    }

    const kind = fields.kind ?? existing.kind;
    assertFieldMatchesKind(kind, {
      sport: fields.sport !== undefined ? fields.sport : existing.sport,
      competition: fields.competition !== undefined ? fields.competition : existing.competition,
      matchId: fields.matchId !== undefined ? fields.matchId : existing.matchId,
    });

    const entry = await this.prisma.topNavItem.update({
      where: { id },
      data: fields,
    });

    await this.auditLogService.record({
      actor,
      action: 'TOP_NAV_ITEM_UPDATED',
      targetType: 'TopNavItem',
      targetId: entry.id,
      metadata: { kind: entry.kind, label: entry.label },
    });

    return entry;
  }

  async remove(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.topNavItem.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Top nav item not found');
    }

    const entry = await this.prisma.topNavItem.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'TOP_NAV_ITEM_REMOVED',
      targetType: 'TopNavItem',
      targetId: entry.id,
      metadata: { kind: entry.kind, label: entry.label },
    });

    return entry;
  }

  /** Every id must belong to this brand, and the full set must be provided - a partial reorder would leave the rest in an undefined relative order. */
  async reorder(brandId: string, orderedIds: string[], actor: AuditActor) {
    const existing = await this.prisma.topNavItem.findMany({ where: { brandId }, select: { id: true } });
    const existingIds = new Set(existing.map((entry) => entry.id));

    if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
      throw new BadRequestException('ids must be exactly the current set of top nav items for this brand');
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) => this.prisma.topNavItem.update({ where: { id }, data: { sortOrder: index } })),
    );

    await this.auditLogService.record({
      actor,
      action: 'TOP_NAV_ITEM_REORDERED',
      targetType: 'TopNavItem',
      targetId: brandId,
      metadata: { order: orderedIds },
    });

    return this.list(brandId);
  }
}

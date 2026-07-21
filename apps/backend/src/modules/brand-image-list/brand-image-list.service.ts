import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BrandImageListKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

/** Metadata only - never the image bytes, so listing stays a small JSON response. */
const METADATA_SELECT = {
  id: true,
  brandId: true,
  kind: true,
  mimeType: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class BrandImageListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(brandId: string, kind: BrandImageListKind) {
    return this.prisma.brandImageListItem.findMany({
      where: { brandId, kind },
      select: METADATA_SELECT,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async add(
    brandId: string,
    kind: BrandImageListKind,
    fileData: Buffer,
    mimeType: string,
    actor: AuditActor,
  ) {
    const data = Buffer.from(fileData);
    const highest = await this.prisma.brandImageListItem.findFirst({
      where: { brandId, kind },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const item = await this.prisma.brandImageListItem.create({
      data: { brandId, kind, data, mimeType, sortOrder: (highest?.sortOrder ?? -1) + 1 },
      select: METADATA_SELECT,
    });

    await this.auditLogService.record({
      actor,
      action: 'BRAND_IMAGE_LIST_ITEM_ADDED',
      targetType: 'BrandImageListItem',
      targetId: item.id,
      metadata: { kind },
    });

    return item;
  }

  /** `brandId` must match the item's own brand - a staff member can never remove another brand's item, even by guessing its id. */
  async remove(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.brandImageListItem.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Image not found');
    }

    const item = await this.prisma.brandImageListItem.delete({ where: { id }, select: METADATA_SELECT });

    await this.auditLogService.record({
      actor,
      action: 'BRAND_IMAGE_LIST_ITEM_REMOVED',
      targetType: 'BrandImageListItem',
      targetId: item.id,
      metadata: { kind: item.kind },
    });

    return item;
  }

  /** Every id must belong to this brand+kind, and the full set must be provided - a partial reorder would leave the rest in an undefined relative order. */
  async reorder(brandId: string, kind: BrandImageListKind, orderedIds: string[], actor: AuditActor) {
    const existing = await this.prisma.brandImageListItem.findMany({
      where: { brandId, kind },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((item) => item.id));

    if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
      throw new BadRequestException('ids must be exactly the current set of items for this brand and kind');
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.brandImageListItem.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    await this.auditLogService.record({
      actor,
      action: 'BRAND_IMAGE_LIST_REORDERED',
      targetType: 'BrandImageListItem',
      targetId: brandId,
      metadata: { kind, order: orderedIds },
    });

    return this.list(brandId, kind);
  }

  /** Includes the raw bytes - only for serving the actual image (see PublicBrandImageListController). */
  async getItemData(brandId: string, id: string) {
    const item = await this.prisma.brandImageListItem.findUnique({ where: { id } });
    if (!item || item.brandId !== brandId) {
      return null;
    }
    return item;
  }
}

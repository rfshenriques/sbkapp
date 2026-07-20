import { Injectable, NotFoundException } from '@nestjs/common';
import type { BrandImageSlot } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

/** Metadata only - never the image bytes, so listing stays a small JSON response. */
const METADATA_SELECT = {
  id: true,
  brandId: true,
  slot: true,
  mimeType: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class BrandImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(brandId: string) {
    return this.prisma.brandImage.findMany({
      where: { brandId },
      select: METADATA_SELECT,
    });
  }

  /** Idempotent - uploading to an already-set slot replaces it in place. */
  async setImage(
    brandId: string,
    slot: BrandImageSlot,
    fileData: Buffer,
    mimeType: string,
    actor: AuditActor,
  ) {
    // multer's Buffer is typed against ArrayBufferLike (could in theory be a
    // SharedArrayBuffer), which Prisma's Bytes field rejects - re-wrapping
    // guarantees a plain ArrayBuffer-backed Buffer instead.
    const data = Buffer.from(fileData);
    const image = await this.prisma.brandImage.upsert({
      where: { brandId_slot: { brandId, slot } },
      create: { brandId, slot, data, mimeType },
      update: { data, mimeType },
      select: METADATA_SELECT,
    });

    await this.auditLogService.record({
      actor,
      action: 'BRAND_IMAGE_SET',
      targetType: 'BrandImage',
      targetId: image.id,
      metadata: { slot },
    });

    return image;
  }

  /** `brandId` must match the image's own brand - a staff member can never remove another brand's image, even by guessing its slot. */
  async removeImage(brandId: string, slot: BrandImageSlot, actor: AuditActor) {
    const existing = await this.prisma.brandImage.findUnique({ where: { brandId_slot: { brandId, slot } } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Brand image not found');
    }

    const image = await this.prisma.brandImage.delete({
      where: { brandId_slot: { brandId, slot } },
      select: METADATA_SELECT,
    });

    await this.auditLogService.record({
      actor,
      action: 'BRAND_IMAGE_REMOVED',
      targetType: 'BrandImage',
      targetId: image.id,
      metadata: { slot },
    });

    return image;
  }

  /** Includes the raw bytes - only for serving the actual image (see PublicBrandImagesController). */
  async getImageData(brandId: string, slot: BrandImageSlot) {
    return this.prisma.brandImage.findUnique({ where: { brandId_slot: { brandId, slot } } });
  }
}

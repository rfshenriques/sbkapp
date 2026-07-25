import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

/** Metadata only - never the image bytes, so listing stays a small JSON response. */
const METADATA_SELECT = {
  id: true,
  brandId: true,
  mimeType: true,
  title: true,
  subtitle: true,
  sortOrder: true,
  betAndGetCampaignId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface PromoCardFields {
  title?: string | null;
  subtitle?: string | null;
  betAndGetCampaignId?: string | null;
}

/**
 * CMS-managed promotional cards for the homepage/Promotions page - each is
 * a staff-uploaded image with optional title/subtitle and an optional link
 * to an already-configured BetAndGetCampaign (see PromoCard in
 * schema.prisma). A card with no campaign link is purely decorative;
 * clicking a linked one resolves to that campaign's scoped matches on the
 * player side (see resolveCampaignLinkPath in apps/frontend).
 */
@Injectable()
export class PromoCardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(brandId: string) {
    return this.prisma.promoCard.findMany({
      where: { brandId },
      select: METADATA_SELECT,
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** A card can only ever link to a campaign owned by its own brand - never validated by trusting the id alone. */
  private async assertCampaignOwnership(brandId: string, betAndGetCampaignId: string | null | undefined) {
    if (!betAndGetCampaignId) return;
    const campaign = await this.prisma.betAndGetCampaign.findUnique({ where: { id: betAndGetCampaignId } });
    if (!campaign || campaign.brandId !== brandId) {
      throw new NotFoundException('Bet & Get campaign not found');
    }
  }

  async add(
    brandId: string,
    fileData: Buffer,
    mimeType: string,
    fields: PromoCardFields,
    actor: AuditActor,
  ) {
    await this.assertCampaignOwnership(brandId, fields.betAndGetCampaignId);
    const data = Buffer.from(fileData);
    const highest = await this.prisma.promoCard.findFirst({
      where: { brandId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const card = await this.prisma.promoCard.create({
      data: {
        brandId,
        data,
        mimeType,
        title: fields.title,
        subtitle: fields.subtitle,
        betAndGetCampaignId: fields.betAndGetCampaignId,
        sortOrder: (highest?.sortOrder ?? -1) + 1,
      },
      select: METADATA_SELECT,
    });

    await this.auditLogService.record({
      actor,
      action: 'PROMO_CARD_ADDED',
      targetType: 'PromoCard',
      targetId: card.id,
      metadata: { title: card.title },
    });

    return card;
  }

  /** `brandId` must match the card's own brand - a staff member can never edit another brand's card, even by guessing its id. */
  async update(brandId: string, id: string, fields: PromoCardFields, actor: AuditActor) {
    const existing = await this.prisma.promoCard.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Promo card not found');
    }
    await this.assertCampaignOwnership(brandId, fields.betAndGetCampaignId);

    const card = await this.prisma.promoCard.update({
      where: { id },
      data: fields,
      select: METADATA_SELECT,
    });

    await this.auditLogService.record({
      actor,
      action: 'PROMO_CARD_UPDATED',
      targetType: 'PromoCard',
      targetId: card.id,
      metadata: { title: card.title },
    });

    return card;
  }

  async remove(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.promoCard.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Promo card not found');
    }

    const card = await this.prisma.promoCard.delete({ where: { id }, select: METADATA_SELECT });

    await this.auditLogService.record({
      actor,
      action: 'PROMO_CARD_REMOVED',
      targetType: 'PromoCard',
      targetId: card.id,
      metadata: { title: card.title },
    });

    return card;
  }

  /** Every id must belong to this brand, and the full set must be provided - a partial reorder would leave the rest in an undefined relative order. */
  async reorder(brandId: string, orderedIds: string[], actor: AuditActor) {
    const existing = await this.prisma.promoCard.findMany({ where: { brandId }, select: { id: true } });
    const existingIds = new Set(existing.map((card) => card.id));

    if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
      throw new BadRequestException('ids must be exactly the current set of promo cards for this brand');
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) => this.prisma.promoCard.update({ where: { id }, data: { sortOrder: index } })),
    );

    await this.auditLogService.record({
      actor,
      action: 'PROMO_CARD_REORDERED',
      targetType: 'PromoCard',
      targetId: brandId,
      metadata: { order: orderedIds },
    });

    return this.list(brandId);
  }

  /** Includes the raw bytes - only for serving the actual image (see PublicPromoCardController). */
  async getItemData(brandId: string, id: string) {
    const card = await this.prisma.promoCard.findUnique({ where: { id } });
    if (!card || card.brandId !== brandId) {
      return null;
    }
    return card;
  }
}

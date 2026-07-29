import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { resolveAudience, type AudienceViewer } from '../audience/audience';
import { BetAndGetCampaignService } from '../bet-and-get/bet-and-get-campaign.service';
import { DepositCampaignService } from '../deposit-campaigns/deposit-campaign.service';
import { campaignPromoStatus, type PromoCardStatus } from './promo-card-status';

/** Metadata only - never the image bytes, so listing stays a small JSON response. */
const METADATA_SELECT = {
  id: true,
  brandId: true,
  mimeType: true,
  title: true,
  subtitle: true,
  sortOrder: true,
  autoCreated: true,
  betAndGetCampaignId: true,
  depositCampaignId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface PromoCardForViewer {
  id: string;
  brandId: string;
  mimeType: string | null;
  title: string | null;
  subtitle: string | null;
  sortOrder: number;
  autoCreated: boolean;
  betAndGetCampaignId: string | null;
  depositCampaignId: string | null;
  createdAt: Date;
  updatedAt: Date;
  hasImage: boolean;
  status: PromoCardStatus;
}

export interface PromoCardFields {
  title?: string | null;
  subtitle?: string | null;
  betAndGetCampaignId?: string | null;
  depositCampaignId?: string | null;
}

/**
 * CMS-managed promotional cards for the homepage/Promotions page - each is
 * a staff-uploaded image with optional title/subtitle and an optional link
 * to an already-configured BetAndGetCampaign or DepositCampaign, never both
 * at once (see PromoCard in schema.prisma). A card with no campaign link is
 * purely decorative; clicking a linked one resolves to that campaign's
 * scoped matches (Bet & Get) or reopens the deposit modal (Deposit) on the
 * player side.
 */
@Injectable()
export class PromoCardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly betAndGetCampaignService: BetAndGetCampaignService,
    private readonly depositCampaignService: DepositCampaignService,
  ) {}

  async list(brandId: string) {
    return this.prisma.promoCard.findMany({
      where: { brandId },
      select: METADATA_SELECT,
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Every card the player-facing homepage/Challenges page should actually
   * show for this viewer, each annotated with its live-computed `status`
   * and whether it has a real image (`hasImage` - false for an
   * auto-created card, see PromoCardAutoSyncService). A card with no
   * linked campaign is purely decorative and always ACTIVE/visible.
   *
   * A linked card is dropped entirely (not just marked DISABLED) when:
   * the viewer isn't in the campaign's target audience (resolveAudience),
   * its computed status is DISABLED (campaign off or not started yet -
   * EARLY_ENDED still shows, just grayed out on the frontend), or - for a
   * logged-in viewer only - they've already exhausted their redemptions on
   * it (see BetAndGetCampaignService.canRedeem / DepositCampaignService.
   * canRedeem), so a player never keeps seeing a promo for a reward they
   * can't get again.
   */
  async listForViewer(brandId: string, viewer: AudienceViewer, userId: string | null): Promise<PromoCardForViewer[]> {
    const cards = await this.list(brandId);

    const visible = await Promise.all(
      cards.map(async (card): Promise<PromoCardForViewer | null> => {
        const hasImage = card.mimeType !== null;

        if (card.betAndGetCampaignId) {
          const campaign = await this.betAndGetCampaignService.get(brandId, card.betAndGetCampaignId);
          const inAudience = resolveAudience(
            campaign.audienceMode,
            campaign.segments.map((segment) => segment.segmentId),
            viewer,
          );
          const status = campaignPromoStatus(campaign);
          if (!inAudience || status === 'DISABLED') {
            return null;
          }
          if (userId && !(await this.betAndGetCampaignService.canRedeem(campaign, userId))) {
            return null;
          }
          return { ...card, hasImage, status };
        }

        if (card.depositCampaignId) {
          const campaign = await this.depositCampaignService.get(brandId, card.depositCampaignId);
          const inAudience = resolveAudience(
            campaign.audienceMode,
            campaign.segments.map((segment) => segment.segmentId),
            viewer,
          );
          const status = campaignPromoStatus(campaign);
          if (!inAudience || status === 'DISABLED') {
            return null;
          }
          if (userId && !(await this.depositCampaignService.canRedeem(campaign, userId))) {
            return null;
          }
          return { ...card, hasImage, status };
        }

        return { ...card, hasImage, status: 'ACTIVE' };
      }),
    );

    return visible.filter((card): card is PromoCardForViewer => card !== null);
  }

  /** A card can only ever link to a campaign owned by its own brand - never validated by trusting the id alone. Linking to both campaign types at once isn't allowed - a card promotes exactly one campaign. */
  private async assertCampaignOwnership(
    brandId: string,
    betAndGetCampaignId: string | null | undefined,
    depositCampaignId: string | null | undefined,
  ) {
    if (betAndGetCampaignId && depositCampaignId) {
      throw new BadRequestException('A promo card can link to a Bet & Get campaign or a Deposit campaign, not both');
    }
    if (betAndGetCampaignId) {
      const campaign = await this.prisma.betAndGetCampaign.findUnique({ where: { id: betAndGetCampaignId } });
      if (!campaign || campaign.brandId !== brandId) {
        throw new NotFoundException('Bet & Get campaign not found');
      }
    }
    if (depositCampaignId) {
      const campaign = await this.prisma.depositCampaign.findUnique({ where: { id: depositCampaignId } });
      if (!campaign || campaign.brandId !== brandId) {
        throw new NotFoundException('Deposit campaign not found');
      }
    }
  }

  async add(
    brandId: string,
    fileData: Buffer,
    mimeType: string,
    fields: PromoCardFields,
    actor: AuditActor,
  ) {
    await this.assertCampaignOwnership(brandId, fields.betAndGetCampaignId, fields.depositCampaignId);
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
        depositCampaignId: fields.depositCampaignId,
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
    // Validate the state the patch actually results in, not just what's
    // being touched this call - an update that only sets depositCampaignId
    // while leaving an existing betAndGetCampaignId untouched would
    // otherwise end up with both set, violating the one-campaign-per-card
    // rule without ever being caught.
    const effectiveBetAndGetCampaignId =
      fields.betAndGetCampaignId !== undefined ? fields.betAndGetCampaignId : existing.betAndGetCampaignId;
    const effectiveDepositCampaignId =
      fields.depositCampaignId !== undefined ? fields.depositCampaignId : existing.depositCampaignId;
    await this.assertCampaignOwnership(brandId, effectiveBetAndGetCampaignId, effectiveDepositCampaignId);

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

  /** Sets/replaces just the image bytes - the only way to give an auto-created card (see PromoCardAutoSyncService) its first piece of artwork, or swap an existing one, without touching its title/subtitle/campaign link. */
  async updateImage(brandId: string, id: string, data: Buffer, mimeType: string, actor: AuditActor) {
    const existing = await this.prisma.promoCard.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Promo card not found');
    }

    const card = await this.prisma.promoCard.update({
      where: { id },
      // Prisma's nullable Bytes update input wants Uint8Array<ArrayBuffer> specifically - Buffer's backing ArrayBufferLike doesn't satisfy that, unlike the plain create() input `add()` uses above.
      data: { data: new Uint8Array(data), mimeType },
      select: METADATA_SELECT,
    });

    await this.auditLogService.record({
      actor,
      action: 'PROMO_CARD_UPDATED',
      targetType: 'PromoCard',
      targetId: card.id,
      metadata: { title: card.title, imageReplaced: true },
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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { resolveAudience, type AudienceViewer } from '../audience/audience';
import { BetAndGetCampaignService } from '../bet-and-get/bet-and-get-campaign.service';
import { DepositCampaignService } from '../deposit-campaigns/deposit-campaign.service';
import { LeaderboardCampaignService } from '../leaderboards/leaderboard-campaign.service';
import { RegisterCampaignService } from '../register-campaigns/register-campaign.service';
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
  registerCampaignId: true,
  leaderboardCampaignId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface PromoCardMetadata {
  id: string;
  brandId: string;
  mimeType: string | null;
  title: string | null;
  subtitle: string | null;
  sortOrder: number;
  autoCreated: boolean;
  betAndGetCampaignId: string | null;
  depositCampaignId: string | null;
  registerCampaignId: string | null;
  leaderboardCampaignId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromoCardForViewer extends PromoCardMetadata {
  hasImage: boolean;
  status: PromoCardStatus;
}

export interface PromoCardFields {
  title?: string | null;
  subtitle?: string | null;
  betAndGetCampaignId?: string | null;
  depositCampaignId?: string | null;
  registerCampaignId?: string | null;
  leaderboardCampaignId?: string | null;
}

interface CardCampaignLinks {
  betAndGetCampaignId: string | null;
  depositCampaignId: string | null;
  registerCampaignId: string | null;
  leaderboardCampaignId: string | null;
}

/**
 * CMS-managed promotional cards for the homepage/Promotions page - each is
 * a staff-uploaded image with optional title/subtitle and an optional link
 * to an already-configured campaign of exactly one of the 4 types (Bet &
 * Get, Deposit, Register, Leaderboard - see PromoCard in schema.prisma,
 * never more than one FK set at once). A card with no campaign link is
 * purely decorative; clicking a linked one resolves to that campaign's
 * scoped matches (Bet & Get), reopens the deposit modal (Deposit), or takes
 * the player to the campaign's own page (Register, Leaderboard) on the
 * player side.
 */
@Injectable()
export class PromoCardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly betAndGetCampaignService: BetAndGetCampaignService,
    private readonly depositCampaignService: DepositCampaignService,
    private readonly registerCampaignService: RegisterCampaignService,
    private readonly leaderboardCampaignService: LeaderboardCampaignService,
  ) {}

  /**
   * Which single campaign (if any) a card links to, resolved to its live
   * row plus the audience-gate + redemption-exhaustion check that campaign
   * type needs - used once by listForViewer below. Register mirrors
   * BetAndGetCampaign's per-player canRedeem check; Leaderboard has no
   * counted-redemption concept (opt-in "join" is the player's own signal,
   * not something a promo card filters against), so its exhaustedFor
   * always returns false.
   */
  private async resolveCampaignLink(brandId: string, card: CardCampaignLinks, userId: string | null) {
    if (card.betAndGetCampaignId) {
      const campaign = await this.betAndGetCampaignService.get(brandId, card.betAndGetCampaignId);
      return {
        campaign,
        exhausted: userId !== null && !(await this.betAndGetCampaignService.canRedeem(campaign, userId)),
      };
    }
    if (card.depositCampaignId) {
      const campaign = await this.depositCampaignService.get(brandId, card.depositCampaignId);
      return {
        campaign,
        exhausted: userId !== null && !(await this.depositCampaignService.canRedeem(campaign, userId)),
      };
    }
    if (card.registerCampaignId) {
      const campaign = await this.registerCampaignService.get(brandId, card.registerCampaignId);
      return {
        campaign,
        exhausted: userId !== null && !(await this.registerCampaignService.canRedeem(campaign, userId)),
      };
    }
    if (card.leaderboardCampaignId) {
      const campaign = await this.leaderboardCampaignService.get(brandId, card.leaderboardCampaignId);
      return { campaign, exhausted: false };
    }
    return null;
  }

  /**
   * Admin listing - every card regardless of live visibility, each
   * annotated with the same live-computed `status` listForViewer uses to
   * decide whether to show it, so staff can immediately see *why* a
   * correctly-configured card isn't appearing on the site (its campaign
   * isn't enabled yet, hasn't started, or already ended) rather than
   * guessing from the raw campaign-link id alone. Unlike listForViewer,
   * never drops a card for audience/exhaustion - those are viewer-specific
   * and meaningless for an admin's own view of "what did I configure."
   */
  async list(brandId: string): Promise<(PromoCardMetadata & { hasImage: boolean; status: PromoCardStatus })[]> {
    const cards = await this.prisma.promoCard.findMany({
      where: { brandId },
      select: METADATA_SELECT,
      orderBy: { sortOrder: 'asc' },
    });
    return Promise.all(
      cards.map(async (card) => {
        const link = await this.resolveCampaignLink(brandId, card, null);
        return {
          ...card,
          hasImage: card.mimeType !== null,
          status: link ? campaignPromoStatus(link.campaign) : 'ACTIVE',
        };
      }),
    );
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
        const link = await this.resolveCampaignLink(brandId, card, userId);
        if (!link) {
          return { ...card, hasImage, status: 'ACTIVE' };
        }

        const { campaign, exhausted } = link;
        const inAudience = resolveAudience(
          campaign.audienceMode,
          campaign.segments.map((segment) => segment.segmentId),
          viewer,
        );
        const status = campaignPromoStatus(campaign);
        if (!inAudience || status === 'DISABLED' || exhausted) {
          return null;
        }
        return { ...card, hasImage, status };
      }),
    );

    return visible.filter((card): card is PromoCardForViewer => card !== null);
  }

  /** A card can only ever link to a campaign owned by its own brand - never validated by trusting the id alone. Linking to more than one campaign type at once isn't allowed - a card promotes exactly one campaign. */
  private async assertCampaignOwnership(brandId: string, links: CardCampaignLinks) {
    const setCount = [
      links.betAndGetCampaignId,
      links.depositCampaignId,
      links.registerCampaignId,
      links.leaderboardCampaignId,
    ].filter((id) => id !== null).length;
    if (setCount > 1) {
      throw new BadRequestException('A promo card can link to at most one campaign');
    }
    if (links.betAndGetCampaignId) {
      const campaign = await this.prisma.betAndGetCampaign.findUnique({ where: { id: links.betAndGetCampaignId } });
      if (!campaign || campaign.brandId !== brandId) {
        throw new NotFoundException('Bet & Get campaign not found');
      }
    }
    if (links.depositCampaignId) {
      const campaign = await this.prisma.depositCampaign.findUnique({ where: { id: links.depositCampaignId } });
      if (!campaign || campaign.brandId !== brandId) {
        throw new NotFoundException('Deposit campaign not found');
      }
    }
    if (links.registerCampaignId) {
      const campaign = await this.prisma.registerCampaign.findUnique({ where: { id: links.registerCampaignId } });
      if (!campaign || campaign.brandId !== brandId) {
        throw new NotFoundException('Register campaign not found');
      }
    }
    if (links.leaderboardCampaignId) {
      const campaign = await this.prisma.leaderboardCampaign.findUnique({
        where: { id: links.leaderboardCampaignId },
      });
      if (!campaign || campaign.brandId !== brandId) {
        throw new NotFoundException('Leaderboard campaign not found');
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
    await this.assertCampaignOwnership(brandId, {
      betAndGetCampaignId: fields.betAndGetCampaignId ?? null,
      depositCampaignId: fields.depositCampaignId ?? null,
      registerCampaignId: fields.registerCampaignId ?? null,
      leaderboardCampaignId: fields.leaderboardCampaignId ?? null,
    });
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
        registerCampaignId: fields.registerCampaignId,
        leaderboardCampaignId: fields.leaderboardCampaignId,
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
    await this.assertCampaignOwnership(brandId, {
      betAndGetCampaignId:
        fields.betAndGetCampaignId !== undefined ? fields.betAndGetCampaignId : existing.betAndGetCampaignId,
      depositCampaignId:
        fields.depositCampaignId !== undefined ? fields.depositCampaignId : existing.depositCampaignId,
      registerCampaignId:
        fields.registerCampaignId !== undefined ? fields.registerCampaignId : existing.registerCampaignId,
      leaderboardCampaignId:
        fields.leaderboardCampaignId !== undefined ? fields.leaderboardCampaignId : existing.leaderboardCampaignId,
    });

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

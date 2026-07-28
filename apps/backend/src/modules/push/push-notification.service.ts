import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AudienceMode, PushNotificationKind } from '@prisma/client';
import webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { PlayerSegmentService } from '../player-segments/player-segment.service';

const DEFAULT_TTL_SECONDS = 86400;

export type AudienceInput =
  | { audienceMode: AudienceMode; segmentIds: string[] }
  | { betAndGetCampaignId: string }
  | { depositCampaignId: string };

export interface SendPushNotificationInput {
  kind?: PushNotificationKind;
  title: string;
  body: string;
  targetUrl?: string;
  audience: AudienceInput;
  sourceBetId?: string;
  ttlSeconds?: number;
}

/**
 * Sends push notifications over the Web Push protocol (see the `web-push`
 * package) and records the send (PushNotification) plus one
 * PushNotificationRecipient row per attempted delivery. TTL is the entire
 * "offline retry" mechanism - the browser's push service (Chrome/FCM,
 * Mozilla, ...) is contractually responsible for holding and retrying
 * delivery to an offline device for up to that many seconds (RFC 8030), so
 * there is no application-level queue or retry job here.
 */
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private vapidConfigured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly playerSegmentService: PlayerSegmentService,
  ) {}

  private ensureVapidConfigured(): void {
    if (this.vapidConfigured) {
      return;
    }
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be set to send push notifications');
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.vapidConfigured = true;
  }

  /** Resolves the live recipient userId set for either a manual audience or a linked campaign's own targeting - resolved once at send time, never re-derived afterward (same "snapshot, not tracked" rule Bet.betAndGetCampaignId already follows). */
  async resolveAudienceUserIds(brandId: string, audience: AudienceInput): Promise<string[]> {
    if ('betAndGetCampaignId' in audience) {
      const campaign = await this.prisma.betAndGetCampaign.findUnique({
        where: { id: audience.betAndGetCampaignId },
        include: { segments: true },
      });
      if (!campaign || campaign.brandId !== brandId) {
        throw new NotFoundException('Bet & Get campaign not found');
      }
      return this.playerSegmentService.resolveUserIdsForAudience(
        brandId,
        campaign.audienceMode,
        campaign.segments.map((segment) => segment.segmentId),
      );
    }
    if ('depositCampaignId' in audience) {
      const campaign = await this.prisma.depositCampaign.findUnique({
        where: { id: audience.depositCampaignId },
        include: { segments: true },
      });
      if (!campaign || campaign.brandId !== brandId) {
        throw new NotFoundException('Deposit campaign not found');
      }
      return this.playerSegmentService.resolveUserIdsForAudience(
        brandId,
        campaign.audienceMode,
        campaign.segments.map((segment) => segment.segmentId),
      );
    }
    return this.playerSegmentService.resolveUserIdsForAudience(brandId, audience.audienceMode, audience.segmentIds);
  }

  /** Every send, newest first, with a recipient count - backs the backoffice history list. */
  async listHistory(brandId: string, limit = 50) {
    return this.prisma.pushNotification.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { _count: { select: { recipients: true } } },
    });
  }

  async getDetail(brandId: string, id: string) {
    const notification = await this.prisma.pushNotification.findUnique({
      where: { id },
      include: { recipients: { orderBy: { sentAt: 'asc' }, include: { user: { select: { username: true } } } } },
    });
    if (!notification || notification.brandId !== brandId) {
      throw new NotFoundException('Push notification not found');
    }
    return notification;
  }

  /** Staff-composed send (CUSTOM, or campaign-linked when audience carries a campaign FK) - fans out immediately and returns once every recipient has been attempted. */
  async send(brandId: string, input: SendPushNotificationInput, actor: AuditActor | null) {
    if ('betAndGetCampaignId' in input.audience && 'depositCampaignId' in input.audience) {
      throw new BadRequestException('A push notification can link to at most one campaign');
    }

    const userIds = await this.resolveAudienceUserIds(brandId, input.audience);

    const notification = await this.prisma.pushNotification.create({
      data: {
        brandId,
        kind: input.kind ?? 'CUSTOM',
        title: input.title,
        body: input.body,
        targetUrl: input.targetUrl,
        audienceMode: 'audienceMode' in input.audience ? input.audience.audienceMode : 'ALL',
        segments:
          'segmentIds' in input.audience && input.audience.segmentIds.length > 0
            ? { create: input.audience.segmentIds.map((segmentId) => ({ segmentId })) }
            : undefined,
        betAndGetCampaignId: 'betAndGetCampaignId' in input.audience ? input.audience.betAndGetCampaignId : undefined,
        depositCampaignId: 'depositCampaignId' in input.audience ? input.audience.depositCampaignId : undefined,
        sourceBetId: input.sourceBetId,
        ttlSeconds: input.ttlSeconds ?? DEFAULT_TTL_SECONDS,
        sentByStaffUserId: actor?.id ?? undefined,
        sentByUsername: actor?.username,
      },
    });

    await this.fanOut(notification.id, brandId, userIds, {
      title: input.title,
      body: input.body,
      targetUrl: input.targetUrl,
      ttlSeconds: notification.ttlSeconds,
    });

    if (actor) {
      await this.auditLogService.record({
        actor,
        action: 'PUSH_NOTIFICATION_SENT',
        targetType: 'PushNotification',
        targetId: notification.id,
        metadata: { title: input.title, kind: notification.kind, recipientCount: userIds.length },
      });
    }

    return notification;
  }

  /**
   * Auto-push fired after a bet settles WON (see PamService.settleSelection,
   * called fire-and-forget once its transaction has committed). Idempotent
   * on sourceBetId - a findFirst guard plus the schema-level unique
   * constraint on PushNotification.sourceBetId as a hard backstop, since
   * this runs outside any transaction and a re-settlement (correction) must
   * never double-send. Mirrors FreebetService.grantSystem's sourceBetId
   * idempotency pattern.
   */
  async sendBetWonPush(brandId: string, betId: string, userId: string): Promise<void> {
    const existing = await this.prisma.pushNotification.findUnique({ where: { sourceBetId: betId } });
    if (existing) {
      return;
    }

    let notification;
    try {
      notification = await this.prisma.pushNotification.create({
        data: {
          brandId,
          kind: 'BET_WON',
          title: 'Bet won!',
          body: 'One of your bets just settled as a winner.',
          targetUrl: '/my-bets',
          sourceBetId: betId,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        return;
      }
      throw error;
    }

    await this.fanOut(notification.id, brandId, [userId], {
      title: notification.title,
      body: notification.body,
      targetUrl: notification.targetUrl ?? undefined,
      ttlSeconds: notification.ttlSeconds,
    });
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  /** web-push's WebPushError carries the push service's HTTP response status - a 404/410 means the subscription is permanently gone. */
  private extractStatusCode(error: unknown): number | undefined {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      const statusCode = (error as { statusCode?: unknown }).statusCode;
      return typeof statusCode === 'number' ? statusCode : undefined;
    }
    return undefined;
  }

  private async fanOut(
    notificationId: string,
    brandId: string,
    userIds: string[],
    payload: { title: string; body: string; targetUrl?: string; ttlSeconds: number },
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    this.ensureVapidConfigured();

    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
    const payloadJson = JSON.stringify({ title: payload.title, body: payload.body, targetUrl: payload.targetUrl });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payloadJson,
            { TTL: payload.ttlSeconds },
          );
          await this.prisma.pushNotificationRecipient.create({
            data: {
              pushNotificationId: notificationId,
              userId: subscription.userId,
              pushSubscriptionId: subscription.id,
              endpoint: subscription.endpoint,
              status: 'SENT',
            },
          });
        } catch (error) {
          const statusCode = this.extractStatusCode(error);
          await this.prisma.pushNotificationRecipient.create({
            data: {
              pushNotificationId: notificationId,
              userId: subscription.userId,
              pushSubscriptionId: subscription.id,
              endpoint: subscription.endpoint,
              status: 'FAILED',
              statusCode,
              errorMessage: error instanceof Error ? error.message : String(error),
            },
          });
          if (statusCode === 404 || statusCode === 410) {
            // Push service confirms this endpoint is gone for good (browser
            // un-registered it) - self-cleaning, no separate sweep job.
            await this.prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
          } else {
            this.logger.warn(`Push send failed for subscription ${subscription.id} (brand ${brandId}): ${String(error)}`);
          }
        }
      }),
    );
  }
}

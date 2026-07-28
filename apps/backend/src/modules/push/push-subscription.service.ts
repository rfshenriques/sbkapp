import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SubscribePushInput {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

/**
 * Player-facing push subscription management - one row per browser/device
 * (see PushSubscription in schema.prisma). Deliberately no brandId scoping
 * here: a subscription belongs to a user, and a user belongs to exactly
 * one brand already, so there's nothing extra to check.
 */
@Injectable()
export class PushSubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upserts by endpoint - re-subscribing the same browser (e.g. after a service worker update rotates nothing but the app re-registers) just refreshes lastSeenAt/keys rather than creating a duplicate row. */
  async subscribe(input: SubscribePushInput) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      },
      update: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
        lastSeenAt: new Date(),
      },
    });
  }

  /** `userId` must match the subscription's own owner - a player can never unsubscribe another player's device, even by guessing its endpoint. */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    const existing = await this.prisma.pushSubscription.findUnique({ where: { endpoint } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Push subscription not found');
    }
    await this.prisma.pushSubscription.delete({ where: { endpoint } });
  }

  async listForUser(userId: string) {
    return this.prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }
}

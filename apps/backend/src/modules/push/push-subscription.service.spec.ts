import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { PushSubscriptionService } from './push-subscription.service';

describe('PushSubscriptionService', () => {
  let moduleRef: TestingModule;
  let service: PushSubscriptionService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let testBrandId: string;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({ data: { name: `Test Brand ${unique}`, slug: `test-brand-${unique}` } });
    testBrandId = brand.id;

    async function createUser() {
      const u = randomUUID();
      return setupPrisma.user.create({
        data: {
          email: `test-${u}@example.com`,
          username: `user_${u.slice(0, 8)}`,
          phone: `+1555${u.replace(/\D/g, '').slice(0, 7)}`,
          passwordHash: 'irrelevant',
          brandId: testBrandId,
        },
      });
    }
    userId = (await createUser()).id;
    otherUserId = (await createUser()).id;
  });

  afterAll(async () => {
    await setupPrisma.pushSubscription.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await setupPrisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await setupPrisma.brand.delete({ where: { id: testBrandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({ providers: [PushSubscriptionService, PrismaService] }).compile();
    await moduleRef.init();
    service = moduleRef.get(PushSubscriptionService);
    prisma = moduleRef.get(PrismaService);
    await prisma.pushSubscription.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
  });

  it('subscribes a new device', async () => {
    const subscription = await service.subscribe({
      userId,
      endpoint: `https://push.example.com/${randomUUID()}`,
      p256dh: 'p256dh-key',
      auth: 'auth-key',
      userAgent: 'test-agent',
    });

    expect(subscription.userId).toBe(userId);
    expect(await prisma.pushSubscription.count({ where: { userId } })).toBe(1);
  });

  it('re-subscribing the same endpoint upserts in place rather than duplicating', async () => {
    const endpoint = `https://push.example.com/${randomUUID()}`;
    await service.subscribe({ userId, endpoint, p256dh: 'old-p256dh', auth: 'old-auth' });
    const updated = await service.subscribe({ userId, endpoint, p256dh: 'new-p256dh', auth: 'new-auth' });

    expect(updated.p256dh).toBe('new-p256dh');
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(1);
  });

  it('unsubscribes the owning player', async () => {
    const endpoint = `https://push.example.com/${randomUUID()}`;
    await service.subscribe({ userId, endpoint, p256dh: 'p256dh-key', auth: 'auth-key' });

    await service.unsubscribe(userId, endpoint);

    expect(await prisma.pushSubscription.findUnique({ where: { endpoint } })).toBeNull();
  });

  it('rejects unsubscribing a device that belongs to a different player', async () => {
    const endpoint = `https://push.example.com/${randomUUID()}`;
    await service.subscribe({ userId, endpoint, p256dh: 'p256dh-key', auth: 'auth-key' });

    await expect(service.unsubscribe(otherUserId, endpoint)).rejects.toBeInstanceOf(NotFoundException);
    expect(await prisma.pushSubscription.findUnique({ where: { endpoint } })).not.toBeNull();
  });

  it('lists only the requesting player’s own subscriptions', async () => {
    await service.subscribe({ userId, endpoint: `https://push.example.com/${randomUUID()}`, p256dh: 'a', auth: 'b' });
    await service.subscribe({ userId: otherUserId, endpoint: `https://push.example.com/${randomUUID()}`, p256dh: 'a', auth: 'b' });

    const subscriptions = await service.listForUser(userId);

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]!.userId).toBe(userId);
  });
});

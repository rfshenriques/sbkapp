import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../admin/audit-log.service';
import { PlayerSegmentService } from '../player-segments/player-segment.service';
import { PushNotificationService } from './push-notification.service';

const sendNotificationMock = vi.fn();
const setVapidDetailsMock = vi.fn();

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetailsMock(...args),
    sendNotification: (...args: unknown[]) => sendNotificationMock(...args),
  },
}));

describe('PushNotificationService', () => {
  let moduleRef: TestingModule;
  let service: PushNotificationService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let testBrandId: string;
  let userId: string;
  let secondUserId: string;
  const actor = { id: 'staff-1', username: 'tester', brandId: '' };

  beforeAll(async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';

    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({ data: { name: `Test Brand ${unique}`, slug: `test-brand-${unique}` } });
    testBrandId = brand.id;
    actor.brandId = testBrandId;

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
    secondUserId = (await createUser()).id;
  });

  afterAll(async () => {
    await setupPrisma.pushNotificationRecipient.deleteMany({ where: { userId: { in: [userId, secondUserId] } } });
    await setupPrisma.pushNotification.deleteMany({ where: { brandId: testBrandId } });
    await setupPrisma.pushSubscription.deleteMany({ where: { userId: { in: [userId, secondUserId] } } });
    await setupPrisma.user.deleteMany({ where: { id: { in: [userId, secondUserId] } } });
    await setupPrisma.brand.delete({ where: { id: testBrandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    sendNotificationMock.mockReset();
    sendNotificationMock.mockResolvedValue(undefined);

    moduleRef = await Test.createTestingModule({
      providers: [PushNotificationService, AuditLogService, PlayerSegmentService, PrismaService],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(PushNotificationService);
    prisma = moduleRef.get(PrismaService);

    await prisma.pushNotificationRecipient.deleteMany({ where: { userId: { in: [userId, secondUserId] } } });
    await prisma.pushNotification.deleteMany({ where: { brandId: testBrandId } });
    await prisma.pushSubscription.deleteMany({ where: { userId: { in: [userId, secondUserId] } } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function subscribe(forUserId: string) {
    return prisma.pushSubscription.create({
      data: { userId: forUserId, endpoint: `https://push.example.com/${randomUUID()}`, p256dh: 'p', auth: 'a' },
    });
  }

  describe('resolveAudienceUserIds', () => {
    it('resolves ALL to every user in the brand', async () => {
      const userIds = await service.resolveAudienceUserIds(testBrandId, { audienceMode: 'ALL', segmentIds: [] });
      expect(userIds.sort()).toEqual([userId, secondUserId].sort());
    });

    it('resolves LOGGED_OUT to an empty set - a push subscription always implies a logged-in user', async () => {
      const userIds = await service.resolveAudienceUserIds(testBrandId, { audienceMode: 'LOGGED_OUT', segmentIds: [] });
      expect(userIds).toEqual([]);
    });

    it('resolves SEGMENTS to members of the given segments only', async () => {
      const segment = await prisma.playerSegment.create({ data: { brandId: testBrandId, name: `seg-${randomUUID()}` } });
      await prisma.playerSegmentMember.create({ data: { segmentId: segment.id, userId } });

      const userIds = await service.resolveAudienceUserIds(testBrandId, { audienceMode: 'SEGMENTS', segmentIds: [segment.id] });

      expect(userIds).toEqual([userId]);

      await prisma.playerSegment.delete({ where: { id: segment.id } });
    });
  });

  describe('send', () => {
    it('fans out to every subscription of every resolved recipient and records a delivery per subscription', async () => {
      await subscribe(userId);
      await subscribe(userId);
      await subscribe(secondUserId);

      const notification = await service.send(
        testBrandId,
        { title: 'Hello', body: 'World', audience: { audienceMode: 'ALL', segmentIds: [] } },
        actor,
      );

      expect(sendNotificationMock).toHaveBeenCalledTimes(3);
      const recipients = await prisma.pushNotificationRecipient.findMany({ where: { pushNotificationId: notification.id } });
      expect(recipients).toHaveLength(3);
      expect(recipients.every((recipient) => recipient.status === 'SENT')).toBe(true);
    });

    it('records an audit log entry for a staff-composed send', async () => {
      const notification = await service.send(
        testBrandId,
        { title: 'Hi', body: 'Body', audience: { audienceMode: 'ALL', segmentIds: [] } },
        actor,
      );

      const entry = await prisma.auditLogEntry.findFirst({ where: { targetId: notification.id, action: 'PUSH_NOTIFICATION_SENT' } });
      expect(entry).not.toBeNull();
    });

    it('marks a 410-status delivery as FAILED and deletes the now-gone subscription', async () => {
      const subscription = await subscribe(userId);
      sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));

      const notification = await service.send(
        testBrandId,
        { title: 'Hi', body: 'Body', audience: { audienceMode: 'ALL', segmentIds: [] } },
        actor,
      );

      const recipients = await prisma.pushNotificationRecipient.findMany({ where: { pushNotificationId: notification.id, userId } });
      expect(recipients[0]!.status).toBe('FAILED');
      expect(recipients[0]!.statusCode).toBe(410);
      expect(await prisma.pushSubscription.findUnique({ where: { id: subscription.id } })).toBeNull();
    });
  });

  describe('sendBetWonPush', () => {
    it('sends exactly once even when called twice for the same bet (re-settlement idempotency)', async () => {
      await subscribe(userId);
      const betId = randomUUID();

      await service.sendBetWonPush(testBrandId, betId, userId);
      await service.sendBetWonPush(testBrandId, betId, userId);

      expect(sendNotificationMock).toHaveBeenCalledTimes(1);
      expect(await prisma.pushNotification.count({ where: { sourceBetId: betId } })).toBe(1);
    });

    it('survives a concurrent double-call via the unique constraint backstop', async () => {
      await subscribe(userId);
      const betId = randomUUID();

      await Promise.all([service.sendBetWonPush(testBrandId, betId, userId), service.sendBetWonPush(testBrandId, betId, userId)]);

      expect(await prisma.pushNotification.count({ where: { sourceBetId: betId } })).toBe(1);
    });
  });
});

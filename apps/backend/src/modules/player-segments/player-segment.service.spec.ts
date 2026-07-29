import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { PlayerSegmentService } from './player-segment.service';

describe('PlayerSegmentService', () => {
  let moduleRef: TestingModule;
  let service: PlayerSegmentService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;
  let userId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_crm_segments', brandId: brandAId };
  });

  afterAll(async () => {
    await setupPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [PlayerSegmentService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(PlayerSegmentService);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `test-${unique}@example.com`,
        username: `user_${unique.slice(0, 8)}`,
        phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'irrelevant',
        brandId: brandAId,
      },
    });
    userId = user.id;
    createdUserIds.push(user.id);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { actorUsername: TEST_ACTOR.username } });
    await prisma.playerSegment.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('creates a segment and lists it back', async () => {
    await service.createSegment(brandAId, 'High rollers', 'Big stakes', TEST_ACTOR);

    const segments = await service.listSegments(brandAId);
    expect(segments.map((segment) => segment.name)).toEqual(['High rollers']);
  });

  it('rejects a duplicate segment name for the same brand', async () => {
    await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);

    await expect(service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('removing a segment deletes it', async () => {
    const segment = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);
    await service.removeSegment(brandAId, segment.id, TEST_ACTOR);

    expect(await service.listSegments(brandAId)).toEqual([]);
  });

  it("a brand can never remove another brand's segment, even by guessing its id", async () => {
    const segment = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);

    await expect(service.removeSegment(brandBId, segment.id, TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sets a color on a segment', async () => {
    const segment = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);

    const updated = await service.setColor(brandAId, segment.id, '#EF0107', TEST_ACTOR);

    expect(updated.colorHex).toBe('#EF0107');
  });

  it('clears a color by setting it to null', async () => {
    const segment = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);
    await service.setColor(brandAId, segment.id, '#EF0107', TEST_ACTOR);

    const cleared = await service.setColor(brandAId, segment.id, null, TEST_ACTOR);

    expect(cleared.colorHex).toBeNull();
  });

  it("a brand can never set another brand's segment color, even by guessing its id", async () => {
    const segment = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);

    await expect(service.setColor(brandBId, segment.id, '#EF0107', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records an audit entry for setColor', async () => {
    const segment = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);
    await service.setColor(brandAId, segment.id, '#EF0107', TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({ where: { actorUsername: TEST_ACTOR.username } });
    expect(entries.map((entry) => entry.action)).toContain('PLAYER_SEGMENT_COLOR_SET');
  });

  it('adds a player to a segment by email or username, idempotently', async () => {
    const segment = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    await service.addMember(brandAId, segment.id, user.username, TEST_ACTOR);
    await service.addMember(brandAId, segment.id, user.username, TEST_ACTOR);

    const members = await prisma.playerSegmentMember.findMany({ where: { segmentId: segment.id } });
    expect(members).toHaveLength(1);
    expect(members[0]?.userId).toBe(userId);
  });

  it('resolves the identifier case-insensitively', async () => {
    const segment = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    await service.addMember(brandAId, segment.id, user.username.toUpperCase(), TEST_ACTOR);

    const members = await prisma.playerSegmentMember.findMany({ where: { segmentId: segment.id } });
    expect(members.map((member) => member.userId)).toEqual([userId]);
  });

  it('adding a nonexistent player throws NotFoundException', async () => {
    const segment = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);

    await expect(
      service.addMember(brandAId, segment.id, 'nobody@example.com', TEST_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removing a member deletes the membership', async () => {
    const segment = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await service.addMember(brandAId, segment.id, user.username, TEST_ACTOR);

    await service.removeMember(brandAId, segment.id, userId, TEST_ACTOR);

    expect(await prisma.playerSegmentMember.findMany({ where: { segmentId: segment.id } })).toEqual([]);
  });

  it("resolveSegmentIdsForUser returns every segment a player belongs to", async () => {
    const segmentA = await service.createSegment(brandAId, 'High rollers', undefined, TEST_ACTOR);
    const segmentB = await service.createSegment(brandAId, 'VIP', undefined, TEST_ACTOR);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await service.addMember(brandAId, segmentA.id, user.username, TEST_ACTOR);
    await service.addMember(brandAId, segmentB.id, user.username, TEST_ACTOR);

    const segmentIds = await service.resolveSegmentIdsForUser(userId);
    expect(new Set(segmentIds)).toEqual(new Set([segmentA.id, segmentB.id]));
  });

  it('resolveSegmentIdsForUser returns an empty array for a player in no segments', async () => {
    expect(await service.resolveSegmentIdsForUser(userId)).toEqual([]);
  });
});

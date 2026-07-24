import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

@Injectable()
export class PlayerSegmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listSegments(brandId: string) {
    return this.prisma.playerSegment.findMany({
      where: { brandId },
      include: { members: { include: { user: { select: { id: true, email: true, username: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async createSegment(brandId: string, name: string, description: string | undefined, actor: AuditActor) {
    const existing = await this.prisma.playerSegment.findUnique({ where: { brandId_name: { brandId, name } } });
    if (existing) {
      throw new ConflictException('A segment with this name already exists');
    }

    const segment = await this.prisma.playerSegment.create({ data: { brandId, name, description } });

    await this.auditLogService.record({
      actor,
      action: 'PLAYER_SEGMENT_CREATED',
      targetType: 'PlayerSegment',
      targetId: segment.id,
      metadata: { name },
    });

    return segment;
  }

  /** `brandId` must match the segment's own brand - a staff member can never remove another brand's segment, even by guessing its id. */
  async removeSegment(brandId: string, id: string, actor: AuditActor) {
    const existing = await this.prisma.playerSegment.findUnique({ where: { id } });
    if (!existing || existing.brandId !== brandId) {
      throw new NotFoundException('Segment not found');
    }

    const segment = await this.prisma.playerSegment.delete({ where: { id } });

    await this.auditLogService.record({
      actor,
      action: 'PLAYER_SEGMENT_REMOVED',
      targetType: 'PlayerSegment',
      targetId: segment.id,
      metadata: { name: segment.name },
    });

    return segment;
  }

  async addMember(brandId: string, segmentId: string, identifier: string, actor: AuditActor) {
    const segment = await this.prisma.playerSegment.findUnique({ where: { id: segmentId } });
    if (!segment || segment.brandId !== brandId) {
      throw new NotFoundException('Segment not found');
    }

    const user = await this.prisma.user.findFirst({
      where: { brandId, OR: [{ email: identifier }, { username: identifier }] },
      select: { id: true, email: true, username: true },
    });
    if (!user) {
      throw new NotFoundException('No player found with that email or username in this brand');
    }

    const member = await this.prisma.playerSegmentMember.upsert({
      where: { segmentId_userId: { segmentId, userId: user.id } },
      create: { segmentId, userId: user.id },
      update: {},
      include: { user: { select: { id: true, email: true, username: true } } },
    });

    await this.auditLogService.record({
      actor,
      action: 'PLAYER_SEGMENT_MEMBER_ADDED',
      targetType: 'PlayerSegment',
      targetId: segmentId,
      metadata: { segmentName: segment.name, username: user.username },
    });

    return member;
  }

  async removeMember(brandId: string, segmentId: string, userId: string, actor: AuditActor) {
    const segment = await this.prisma.playerSegment.findUnique({ where: { id: segmentId } });
    if (!segment || segment.brandId !== brandId) {
      throw new NotFoundException('Segment not found');
    }

    const member = await this.prisma.playerSegmentMember.findUnique({
      where: { segmentId_userId: { segmentId, userId } },
    });
    if (!member) {
      throw new NotFoundException('Player is not a member of this segment');
    }

    await this.prisma.playerSegmentMember.delete({ where: { id: member.id } });

    await this.auditLogService.record({
      actor,
      action: 'PLAYER_SEGMENT_MEMBER_REMOVED',
      targetType: 'PlayerSegment',
      targetId: segmentId,
      metadata: { segmentName: segment.name, userId },
    });

    return member;
  }

  /** Used by audience resolution at bet-facing endpoints - which segments (of this brand or any) a logged-in player belongs to. */
  async resolveSegmentIdsForUser(userId: string): Promise<string[]> {
    const memberships = await this.prisma.playerSegmentMember.findMany({
      where: { userId },
      select: { segmentId: true },
    });
    return memberships.map((membership) => membership.segmentId);
  }
}

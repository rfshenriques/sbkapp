import { Injectable } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditActor {
  id: string | null;
  username: string;
  /** Which brand this action happened in - staff only ever act within their own brand. */
  brandId: string;
}

export interface RecordAuditEntry {
  actor: AuditActor;
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}

/** Accepts either the module-level PrismaService or a $transaction callback's client, so callers inside a transaction can log atomically with the change they're recording. */
type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: RecordAuditEntry, client: PrismaClientLike = this.prisma): Promise<void> {
    await client.auditLogEntry.create({
      data: {
        actorStaffUserId: entry.actor.id,
        actorUsername: entry.actor.username,
        brandId: entry.actor.brandId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata,
      },
    });
  }

  async listEntries(brandId: string, limit: number) {
    return this.prisma.auditLogEntry.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

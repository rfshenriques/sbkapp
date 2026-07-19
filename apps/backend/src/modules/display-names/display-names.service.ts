import { Injectable, NotFoundException } from '@nestjs/common';
import type { DisplayNameEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

@Injectable()
export class DisplayNamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(entityType?: DisplayNameEntityType) {
    return this.prisma.displayNameOverride.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: [{ entityType: 'asc' }, { rawName: 'asc' }],
    });
  }

  async listAssigned() {
    return this.prisma.displayNameOverride.findMany({
      where: { displayName: { not: null } },
      orderBy: [{ entityType: 'asc' }, { rawName: 'asc' }],
    });
  }

  /** Only inserts names not already known for that entity type - existing rows (and any displayName already set on them) are left untouched. */
  async syncNames(entityType: DisplayNameEntityType, names: string[]) {
    const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    const existing = await this.prisma.displayNameOverride.findMany({
      where: { entityType, rawName: { in: uniqueNames } },
      select: { rawName: true },
    });
    const existingNames = new Set(existing.map((row) => row.rawName));
    const newNames = uniqueNames.filter((name) => !existingNames.has(name));

    if (newNames.length > 0) {
      await this.prisma.displayNameOverride.createMany({
        data: newNames.map((rawName) => ({ entityType, rawName })),
        skipDuplicates: true,
      });
    }

    return this.list(entityType);
  }

  async setDisplayName(id: string, displayName: string | null, actor: AuditActor) {
    const existing = await this.prisma.displayNameOverride.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Display name override not found');
    }

    const override = await this.prisma.displayNameOverride.update({
      where: { id },
      data: { displayName },
    });

    await this.auditLogService.record({
      actor,
      action: 'DISPLAY_NAME_OVERRIDE_SET',
      targetType: 'DisplayNameOverride',
      targetId: override.id,
      metadata: { entityType: override.entityType, rawName: override.rawName, displayName },
    });

    return override;
  }
}

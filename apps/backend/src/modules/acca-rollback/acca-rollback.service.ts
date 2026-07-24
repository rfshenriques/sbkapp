import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import type { AccaRollbackConfigValues } from './acca-rollback';

const DEFAULT_CONFIG: AccaRollbackConfigValues = {
  minSelections: 3,
  lossThreshold: 1,
  rewardPercent: 100,
  enabled: false,
};

@Injectable()
export class AccaRollbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** No row yet means the brand has never touched this - returns the same defaults a fresh row would have, rollback off. */
  async getConfig(brandId: string): Promise<AccaRollbackConfigValues> {
    const config = await this.prisma.accaRollbackConfig.findUnique({ where: { brandId } });
    return config
      ? {
          minSelections: config.minSelections,
          lossThreshold: config.lossThreshold,
          rewardPercent: config.rewardPercent,
          enabled: config.enabled,
        }
      : DEFAULT_CONFIG;
  }

  async setConfig(brandId: string, values: AccaRollbackConfigValues, actor: AuditActor) {
    const config = await this.prisma.accaRollbackConfig.upsert({
      where: { brandId },
      create: { brandId, ...values },
      update: { ...values },
    });

    await this.auditLogService.record({
      actor,
      action: 'ACCA_ROLLBACK_CONFIG_SET',
      targetType: 'AccaRollbackConfig',
      targetId: config.id,
      metadata: { ...values },
    });

    return config;
  }
}

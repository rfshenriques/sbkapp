import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import type { InsuranceBetConfigValues } from './insurance-bet';

const DEFAULT_CONFIG: InsuranceBetConfigValues = {
  costPercent: 10,
  enabled: false,
};

@Injectable()
export class InsuranceBetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** No row yet means the brand has never touched this - returns the same defaults a fresh row would have, insurance off. */
  async getConfig(brandId: string): Promise<InsuranceBetConfigValues> {
    const config = await this.prisma.insuranceBetConfig.findUnique({ where: { brandId } });
    return config
      ? {
          costPercent: config.costPercent,
          enabled: config.enabled,
        }
      : DEFAULT_CONFIG;
  }

  async setConfig(brandId: string, values: InsuranceBetConfigValues, actor: AuditActor) {
    const config = await this.prisma.insuranceBetConfig.upsert({
      where: { brandId },
      create: { brandId, ...values },
      update: { ...values },
    });

    await this.auditLogService.record({
      actor,
      action: 'INSURANCE_BET_CONFIG_SET',
      targetType: 'InsuranceBetConfig',
      targetId: config.id,
      metadata: { ...values },
    });

    return config;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import type { CashoutConfigValues } from './cashout';

const DEFAULT_CONFIG: CashoutConfigValues = {
  enabled: false,
  marginPercent: 5,
};

@Injectable()
export class CashoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** No row yet means the brand has never touched this - returns the same defaults a fresh row would have, cashout off. */
  async getConfig(brandId: string): Promise<CashoutConfigValues> {
    const config = await this.prisma.cashoutConfig.findUnique({ where: { brandId } });
    return config
      ? {
          enabled: config.enabled,
          marginPercent: config.marginPercent,
        }
      : DEFAULT_CONFIG;
  }

  async setConfig(brandId: string, values: CashoutConfigValues, actor: AuditActor) {
    const config = await this.prisma.cashoutConfig.upsert({
      where: { brandId },
      create: { brandId, ...values },
      update: { ...values },
    });

    await this.auditLogService.record({
      actor,
      action: 'CASHOUT_CONFIG_SET',
      targetType: 'CashoutConfig',
      targetId: config.id,
      metadata: { ...values },
    });

    return config;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import type { AccaBoostConfigValues } from './acca-boost';

const DEFAULT_CONFIG: AccaBoostConfigValues = {
  boostPercentPerLeg: 5,
  minSelections: 3,
  minOddsPerLeg: 1.2,
  enabled: false,
};

@Injectable()
export class AccaBoostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** No row yet means the brand has never touched this - returns the same defaults a fresh row would have, boost off. */
  async getConfig(brandId: string): Promise<AccaBoostConfigValues> {
    const config = await this.prisma.accaBoostConfig.findUnique({ where: { brandId } });
    return config
      ? {
          boostPercentPerLeg: config.boostPercentPerLeg,
          minSelections: config.minSelections,
          minOddsPerLeg: config.minOddsPerLeg,
          enabled: config.enabled,
        }
      : DEFAULT_CONFIG;
  }

  async setConfig(brandId: string, values: AccaBoostConfigValues, actor: AuditActor) {
    const config = await this.prisma.accaBoostConfig.upsert({
      where: { brandId },
      create: { brandId, ...values },
      update: { ...values },
    });

    await this.auditLogService.record({
      actor,
      action: 'ACCA_BOOST_CONFIG_SET',
      targetType: 'AccaBoostConfig',
      targetId: config.id,
      metadata: { ...values },
    });

    return config;
  }
}

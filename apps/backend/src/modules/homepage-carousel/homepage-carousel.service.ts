import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

export interface HomepageCarouselConfigValues {
  enabled: boolean;
  autoScrollSeconds: number;
}

const DEFAULT_CONFIG: HomepageCarouselConfigValues = {
  enabled: false,
  autoScrollSeconds: 6,
};

@Injectable()
export class HomepageCarouselService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** No row yet means the brand has never touched this - returns the same defaults a fresh row would have, auto-scroll off. */
  async getConfig(brandId: string): Promise<HomepageCarouselConfigValues> {
    const config = await this.prisma.homepageCarouselConfig.findUnique({ where: { brandId } });
    return config
      ? { enabled: config.enabled, autoScrollSeconds: config.autoScrollSeconds }
      : DEFAULT_CONFIG;
  }

  async setConfig(brandId: string, values: HomepageCarouselConfigValues, actor: AuditActor) {
    const config = await this.prisma.homepageCarouselConfig.upsert({
      where: { brandId },
      create: { brandId, ...values },
      update: { ...values },
    });

    await this.auditLogService.record({
      actor,
      action: 'HOMEPAGE_CAROUSEL_CONFIG_SET',
      targetType: 'HomepageCarouselConfig',
      targetId: config.id,
      metadata: { ...values },
    });

    return config;
  }
}

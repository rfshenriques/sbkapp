import { Module } from '@nestjs/common';
import { EventBusModule } from './event-bus/event-bus.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { KycModule } from './modules/kyc/kyc.module';
import { PamModule } from './modules/pam/pam.module';
import { CompetitionRankingModule } from './modules/competition-ranking/competition-ranking.module';
import { CompetitionQuicklinkModule } from './modules/competition-quicklinks/competition-quicklink.module';
import { PlayerSegmentModule } from './modules/player-segments/player-segment.module';
import { WalletPaymentsModule } from './modules/wallet-payments/wallet-payments.module';
import { PromotionsBonusModule } from './modules/promotions-bonus/promotions-bonus.module';
import { RiskModule } from './modules/risk/risk.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { CrmModule } from './modules/crm/crm.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { CmsModule } from './modules/cms/cms.module';
import { DesignBackofficeModule } from './modules/design-backoffice/design-backoffice.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MasterModule } from './modules/master/master.module';
import { TeamColorsModule } from './modules/team-colors/team-colors.module';
import { DisplayNamesModule } from './modules/display-names/display-names.module';
import { BrandImagesModule } from './modules/brand-images/brand-images.module';
import { BrandImageListModule } from './modules/brand-image-list/brand-image-list.module';
import { MarginsModule } from './modules/margins/margins.module';
import { MarketingSpendModule } from './modules/marketing-spend/marketing-spend.module';
import { FreebetModule } from './modules/freebets/freebet.module';
import { PromoCardModule } from './modules/promo-cards/promo-card.module';

@Module({
  imports: [
    PrismaModule,
    EventBusModule,
    HealthModule,
    AuthModule,
    KycModule,
    PamModule,
    CompetitionRankingModule,
    CompetitionQuicklinkModule,
    PlayerSegmentModule,
    WalletPaymentsModule,
    PromotionsBonusModule,
    RiskModule,
    FraudModule,
    CrmModule,
    MarketingModule,
    CmsModule,
    DesignBackofficeModule,
    NotificationsModule,
    AdminModule,
    ReportsModule,
    MasterModule,
    TeamColorsModule,
    DisplayNamesModule,
    BrandImagesModule,
    BrandImageListModule,
    MarginsModule,
    MarketingSpendModule,
    FreebetModule,
    PromoCardModule,
  ],
})
export class AppModule {}

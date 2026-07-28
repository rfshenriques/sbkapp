import type { RouteObject } from 'react-router-dom';
import AccaBoostPage from '../pages/AccaBoostPage';
import AccaRollbackPage from '../pages/AccaRollbackPage';
import AuditLogPage from '../pages/AuditLogPage';
import BetAndGetCampaignsPage from '../pages/BetAndGetCampaignsPage';
import BetHistoryReportPage from '../pages/BetHistoryReportPage';
import DepositCampaignsPage from '../pages/DepositCampaignsPage';
import InsuranceBetPage from '../pages/InsuranceBetPage';
import CmsImagesPage from '../pages/CmsImagesPage';
import CmsPaymentsPage from '../pages/CmsPaymentsPage';
import CmsPromoCardsPage from '../pages/CmsPromoCardsPage';
import CmsQuicklinksPage from '../pages/CmsQuicklinksPage';
import CmsSponsorsPage from '../pages/CmsSponsorsPage';
import CompetitionRankingPage from '../pages/CompetitionRankingPage';
import CompetitionTiersPage from '../pages/CompetitionTiersPage';
import DisplayNamesPage from '../pages/DisplayNamesPage';
import FreebetsPage from '../pages/FreebetsPage';
import ManualMarketsPage from '../pages/ManualMarketsPage';
import MarginsPage from '../pages/MarginsPage';
import MarketingSpendPage from '../pages/MarketingSpendPage';
import NotFoundPage from '../pages/NotFoundPage';
import BoostsPage from '../pages/BoostsPage';
import OddsLadderPage from '../pages/OddsLadderPage';
import OddsOverridesPage from '../pages/OddsOverridesPage';
import PlayerSegmentsPage from '../pages/PlayerSegmentsPage';
import PushNotificationsPage from '../pages/PushNotificationsPage';
import RegistrationsPage from '../pages/RegistrationsPage';
import ReportsPage from '../pages/ReportsPage';
import SettlementPage from '../pages/SettlementPage';
import StakeLimitsPage from '../pages/StakeLimitsPage';
import StaffLoginPage from '../pages/StaffLoginPage';
import TradingPage from '../pages/TradingPage';
import StaffUsersPage from '../pages/StaffUsersPage';
import TeamColorsPage from '../pages/TeamColorsPage';
import { AppShell } from './AppShell';
import { RequireRoles } from './RequireRoles';
import { RequireStaffAuth } from './RequireStaffAuth';

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      {
        index: true,
        element: (
          <RequireStaffAuth>
            <SettlementPage />
          </RequireStaffAuth>
        ),
      },
      {
        path: 'trading',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <TradingPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'odds-overrides',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <OddsOverridesPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'odds-ladder',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <OddsLadderPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'boosts',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <BoostsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'acca-boost',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <AccaBoostPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'acca-rollback',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <AccaRollbackPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'insurance-bet',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <InsuranceBetPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'bet-and-get',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <BetAndGetCampaignsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'deposit-campaigns',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <DepositCampaignsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'stake-limits',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <StakeLimitsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'manual-markets',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <ManualMarketsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'staff-users',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN']}>
              <StaffUsersPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'audit-log',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN']}>
              <AuditLogPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'reports',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN']}>
              <ReportsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'bet-history',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN']}>
              <BetHistoryReportPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'team-colors',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CMS']}>
              <TeamColorsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'display-names',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CMS']}>
              <DisplayNamesPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'competition-tiers',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <CompetitionTiersPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'margins',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <MarginsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'registrations',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN']}>
              <RegistrationsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'marketing-spend',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN']}>
              <MarketingSpendPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'competition-ranking',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CMS']}>
              <CompetitionRankingPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'player-segments',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CRM']}>
              <PlayerSegmentsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'push-notifications',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CRM']}>
              <PushNotificationsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'freebets',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CRM']}>
              <FreebetsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'cms-images',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CMS']}>
              <CmsImagesPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'cms-sponsors',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CMS']}>
              <CmsSponsorsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'cms-payments',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CMS']}>
              <CmsPaymentsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'cms-promo-cards',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CMS']}>
              <CmsPromoCardsPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      {
        path: 'cms-quicklinks',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CMS']}>
              <CmsQuicklinksPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      { path: 'login', Component: StaffLoginPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

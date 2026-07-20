import type { RouteObject } from 'react-router-dom';
import AuditLogPage from '../pages/AuditLogPage';
import CompetitionRankingPage from '../pages/CompetitionRankingPage';
import DisplayNamesPage from '../pages/DisplayNamesPage';
import MarketsPage from '../pages/MarketsPage';
import NotFoundPage from '../pages/NotFoundPage';
import ReportsPage from '../pages/ReportsPage';
import SettlementPage from '../pages/SettlementPage';
import StaffLoginPage from '../pages/StaffLoginPage';
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
        path: 'markets',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'TRADING']}>
              <MarketsPage />
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
        path: 'competition-ranking',
        element: (
          <RequireStaffAuth>
            <RequireRoles roles={['ADMIN', 'CMS']}>
              <CompetitionRankingPage />
            </RequireRoles>
          </RequireStaffAuth>
        ),
      },
      { path: 'login', Component: StaffLoginPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

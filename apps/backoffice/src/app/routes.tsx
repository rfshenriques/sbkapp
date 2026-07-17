import type { RouteObject } from 'react-router-dom';
import NotFoundPage from '../pages/NotFoundPage';
import SettlementPage from '../pages/SettlementPage';
import StaffLoginPage from '../pages/StaffLoginPage';
import { AppShell } from './AppShell';
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
      { path: 'login', Component: StaffLoginPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

import type { RouteObject } from 'react-router-dom';
import BrandDetailPage from '../pages/BrandDetailPage';
import BrandsPage from '../pages/BrandsPage';
import MasterLoginPage from '../pages/MasterLoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import { AppShell } from './AppShell';
import { RequireMasterAuth } from './RequireMasterAuth';

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      {
        index: true,
        element: (
          <RequireMasterAuth>
            <BrandsPage />
          </RequireMasterAuth>
        ),
      },
      {
        path: 'brands/:id',
        element: (
          <RequireMasterAuth>
            <BrandDetailPage />
          </RequireMasterAuth>
        ),
      },
      { path: 'login', Component: MasterLoginPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';

const OddsBoardPage = lazy(() => import('../pages/OddsBoardPage'));
const MatchDetailPage = lazy(() => import('../pages/MatchDetailPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: OddsBoardPage },
      { path: 'matches/:matchId', Component: MatchDetailPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

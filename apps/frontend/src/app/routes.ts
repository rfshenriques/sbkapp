import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';

const OddsBoardPage = lazy(() => import('../pages/OddsBoardPage'));
export const loadMatchDetailPage = () => import('../pages/MatchDetailPage');
const MatchDetailPage = lazy(loadMatchDetailPage);
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: OddsBoardPage },
      { path: 'matches/:matchId', Component: MatchDetailPage },
      { path: 'login', Component: LoginPage },
      { path: 'register', Component: RegisterPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

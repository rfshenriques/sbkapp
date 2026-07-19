import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';
// Not lazy-loaded: it's the fallback for render errors, including a failed
// chunk load, so it must not depend on a chunk load succeeding itself.
import ErrorPage from '../pages/ErrorPage';

const OddsBoardPage = lazy(() => import('../pages/OddsBoardPage'));
export const loadMatchDetailPage = () => import('../pages/MatchDetailPage');
const MatchDetailPage = lazy(loadMatchDetailPage);
const SportPage = lazy(() => import('../pages/SportPage'));
const MyBetsPage = lazy(() => import('../pages/MyBetsPage'));
const PromotionsPage = lazy(() => import('../pages/PromotionsPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    ErrorBoundary: ErrorPage,
    children: [
      { index: true, Component: OddsBoardPage },
      { path: 'matches/:matchId', Component: MatchDetailPage },
      { path: 'sports/:sport', Component: SportPage },
      { path: 'live', Component: SportPage },
      { path: 'my-bets', Component: MyBetsPage },
      { path: 'promotions', Component: PromotionsPage },
      { path: 'login', Component: LoginPage },
      { path: 'register', Component: RegisterPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

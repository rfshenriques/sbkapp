import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';
// Not lazy-loaded: it's the fallback for render errors, including a failed
// chunk load, so it must not depend on a chunk load succeeding itself.
import ErrorPage from '../pages/ErrorPage';
import { LoginDeepLink, RegisterDeepLink } from '../features/auth/AuthDeepLink';

const OddsBoardPage = lazy(() => import('../pages/OddsBoardPage'));
export const loadMatchDetailPage = () => import('../pages/MatchDetailPage');
const MatchDetailPage = lazy(loadMatchDetailPage);
const CampaignMatchesPage = lazy(() => import('../pages/CampaignMatchesPage'));
const BrowsePage = lazy(() => import('../pages/BrowsePage'));
const SportPage = lazy(() => import('../pages/SportPage'));
const MyBetsPage = lazy(() => import('../pages/MyBetsPage'));
const PromotionsPage = lazy(() => import('../pages/PromotionsPage'));
const BoostsPage = lazy(() => import('../pages/BoostsPage'));
const SpecialsPage = lazy(() => import('../pages/SpecialsPage'));
const ResponsibleGamblingPage = lazy(() => import('../pages/ResponsibleGamblingPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    ErrorBoundary: ErrorPage,
    children: [
      { index: true, Component: OddsBoardPage },
      { path: 'matches/:matchId', Component: MatchDetailPage },
      { path: 'campaigns/:campaignId', Component: CampaignMatchesPage },
      { path: 'browse', Component: BrowsePage },
      { path: 'sports/:sport', Component: SportPage },
      { path: 'live', Component: SportPage },
      { path: 'my-bets', Component: MyBetsPage },
      { path: 'promotions', Component: PromotionsPage },
      { path: 'boosts', Component: BoostsPage },
      { path: 'specials', Component: SpecialsPage },
      { path: 'responsible-gambling', Component: ResponsibleGamblingPage },
      // Bookmarkable/shareable URLs - open the auth modal (rendered by
      // AppShell over whatever page is actually current) then redirect to
      // / immediately, rather than being pages of their own. See
      // AuthDeepLink.tsx for why: a routed Login/Register page unmounts
      // whatever was on screen, leaving nothing behind the modal.
      { path: 'login', Component: LoginDeepLink },
      { path: 'register', Component: RegisterDeepLink },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

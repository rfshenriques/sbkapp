import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initAnalytics, track } from '../../lib/analytics';

/** Mounted once from AppShell - tracks a PAGE_VIEW on every route change and starts the periodic/unload flush. */
export function useAnalyticsPageViews(): void {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    track('PAGE_VIEW', { path: location.pathname });
  }, [location.pathname]);
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import * as backendApi from '../lib/backendApi';

/** Short enough that the numbers feel live without hammering the backend. */
const LIVE_REFRESH_INTERVAL_MS = 10_000;

export default function AnalyticsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = { from: from || undefined, to: to || undefined };

  const {
    data: live,
    isPending: livePending,
    isError: liveError,
  } = useQuery({
    queryKey: ['analytics-live'],
    queryFn: () => backendApi.getLiveAnalytics(),
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
  });

  const {
    data: summary,
    isPending: summaryPending,
    isError: summaryError,
  } = useQuery({
    queryKey: ['analytics-summary', range.from, range.to],
    queryFn: () => backendApi.getAnalyticsSummary(range),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-secondary">Live now</h2>
          <span className="text-xs text-text-secondary">Refreshes every {LIVE_REFRESH_INTERVAL_MS / 1000}s</span>
        </div>
        {livePending && (
          <div className="mt-2 space-y-2" aria-label="Loading live numbers" role="status">
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {liveError && <p className="mt-2 text-sm text-danger">Failed to load live numbers.</p>}
        {live && (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-text-secondary">On site now</p>
              <p className="text-xl font-semibold">{live.activeSessions}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Logged in now</p>
              <p className="text-xl font-semibold text-brand">{live.loggedInUsers}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Events/min</p>
              <p className="text-xl font-semibold">{live.eventsLastMinute}</p>
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-text-secondary">
          "Now" means active in the last {live?.windowMinutes ?? 5} minutes.
        </p>
      </Card>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="analytics-from" className="block text-xs text-text-secondary">
            From
          </label>
          <input
            id="analytics-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="analytics-to" className="block text-xs text-text-secondary">
            To
          </label>
          <input
            id="analytics-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {summaryPending && (
        <div className="mt-4 space-y-2" aria-label="Loading summary" role="status">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      {summaryError && <p className="mt-4 text-sm text-danger">Failed to load analytics summary.</p>}

      {summary && (
        <>
          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Events by type</h2>
            {summary.eventCounts.length === 0 ? (
              <p className="mt-2 text-sm text-text-secondary">No events in this range.</p>
            ) : (
              <table className="mt-2 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary">
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.eventCounts.map((entry) => (
                    <tr key={entry.type} className="border-b border-border last:border-0">
                      <td className="py-2">{entry.type}</td>
                      <td className="py-2">{entry.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Top pages</h2>
            {summary.topPaths.length === 0 ? (
              <p className="mt-2 text-sm text-text-secondary">No page views in this range.</p>
            ) : (
              <table className="mt-2 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary">
                    <th className="py-2 font-medium">Page</th>
                    <th className="py-2 font-medium">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topPaths.map((entry) => (
                    <tr key={entry.path} className="border-b border-border last:border-0">
                      <td className="py-2">{entry.path}</td>
                      <td className="py-2">{entry.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = { from: from || undefined, to: to || undefined };

  const {
    data: summary,
    isPending: summaryPending,
    isError: summaryError,
  } = useQuery({
    queryKey: ['report-summary', range.from, range.to],
    queryFn: () => backendApi.getReportSummary(range),
  });

  const {
    data: staffActivity,
    isPending: activityPending,
    isError: activityError,
  } = useQuery({
    queryKey: ['report-staff-activity', range.from, range.to],
    queryFn: () => backendApi.getStaffActivity(range),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Reports</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="report-from" className="block text-xs text-text-secondary">
            From
          </label>
          <input
            id="report-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="report-to" className="block text-xs text-text-secondary">
            To
          </label>
          <input
            id="report-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {summaryPending && <p className="mt-4 text-sm text-text-secondary">Loading summary…</p>}
      {summaryError && <p className="mt-4 text-sm text-danger">Failed to load report summary.</p>}

      {summary && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Card>
              <p className="text-xs text-text-secondary">Bets</p>
              <p className="text-xl font-semibold">{summary.betCount}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">Total stake</p>
              <p className="text-xl font-semibold">{formatCents(summary.totalStakeCents)}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">Settled stake</p>
              <p className="text-xl font-semibold">{formatCents(summary.settledStakeCents)}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">Settled payout</p>
              <p className="text-xl font-semibold">{formatCents(summary.settledPayoutCents)}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">GGR (settled)</p>
              <p
                className={`text-xl font-semibold ${summary.ggrCents < 0 ? 'text-danger' : 'text-brand'}`}
              >
                {formatCents(summary.ggrCents)}
              </p>
            </Card>
          </div>

          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Bets by status</h2>
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Count</th>
                  <th className="py-2 font-medium">Stake</th>
                </tr>
              </thead>
              <tbody>
                {summary.statusBreakdown.map((entry) => (
                  <tr key={entry.status} className="border-b border-border last:border-0">
                    <td className="py-2">{entry.status}</td>
                    <td className="py-2">{entry.count}</td>
                    <td className="py-2 text-text-secondary">{formatCents(entry.stakeCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <Card className="mt-4">
        <h2 className="text-sm font-medium text-text-secondary">Staff settlement activity</h2>
        {activityPending && <p className="mt-2 text-sm text-text-secondary">Loading…</p>}
        {activityError && (
          <p className="mt-2 text-sm text-danger">Failed to load staff activity.</p>
        )}
        {staffActivity && staffActivity.length === 0 && (
          <p className="mt-2 text-sm text-text-secondary">No settlements in this range.</p>
        )}
        {staffActivity && staffActivity.length > 0 && (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="py-2 font-medium">Staff member</th>
                <th className="py-2 font-medium">Selections settled</th>
              </tr>
            </thead>
            <tbody>
              {staffActivity.map((entry) => (
                <tr key={entry.actorUsername} className="border-b border-border last:border-0">
                  <td className="py-2">{entry.actorUsername}</td>
                  <td className="py-2">{entry.settlementCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import * as backendApi from '../lib/backendApi';
import type { ReportGranularity } from '../lib/backendApi';
import { bucketDate } from '../lib/bucketDate';

const GRANULARITIES: { value: ReportGranularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const tooltipContentStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
};
const tooltipLabelStyle = { color: 'var(--color-text-primary)' };

function formatBucketLabel(iso: string, granularity: ReportGranularity): string {
  const date = new Date(iso);
  if (granularity === 'month') {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', timeZone: 'UTC' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function RegistrationsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [granularity, setGranularity] = useState<ReportGranularity>('day');
  const range = { from: from || undefined, to: to || undefined };

  const {
    data: registrations,
    isPending: registrationsPending,
    isError: registrationsError,
  } = useQuery({
    queryKey: ['registrations-time-series', range.from, range.to, granularity],
    queryFn: () => backendApi.getRegistrationsTimeSeries(range, granularity),
  });

  const {
    data: ggr,
    isPending: ggrPending,
    isError: ggrError,
  } = useQuery({
    queryKey: ['ggr-time-series', range.from, range.to, granularity],
    queryFn: () => backendApi.getGgrTimeSeries(range, granularity),
  });

  const { data: spendEntries } = useQuery({
    queryKey: ['marketing-spend-for-registrations', range.from, range.to],
    queryFn: () => backendApi.listMarketingSpend(range),
  });

  const spendByBucket = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of spendEntries ?? []) {
      const bucket = bucketDate(new Date(entry.date), granularity).toISOString();
      map.set(bucket, (map.get(bucket) ?? 0) + entry.amountCents);
    }
    return map;
  }, [spendEntries, granularity]);

  // Only overlay spend once at least one entry falls in range - an all-zero
  // series would read as "spend is zero," which isn't the honest message
  // when nothing has been logged at all.
  const hasSpend = spendByBucket.size > 0;

  const registrationsChartData = useMemo(
    () =>
      (registrations ?? []).map((point) => ({
        label: formatBucketLabel(point.bucket, granularity),
        count: point.count,
      })),
    [registrations, granularity],
  );

  const ggrChartData = useMemo(
    () =>
      (ggr ?? []).map((point) => ({
        label: formatBucketLabel(point.bucket, granularity),
        ggr: point.ggrCents / 100,
        spend: hasSpend ? (spendByBucket.get(point.bucket) ?? 0) / 100 : undefined,
      })),
    [ggr, granularity, spendByBucket, hasSpend],
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Registrations</h1>
      <p className="mt-1 text-sm text-text-secondary">
        New player signups and GGR over time, from real data only. Log spend on the Marketing spend
        page to see it overlaid against GGR here.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="registrations-from" className="block text-xs text-text-secondary">
            From
          </label>
          <input
            id="registrations-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="registrations-to" className="block text-xs text-text-secondary">
            To
          </label>
          <input
            id="registrations-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2" role="group" aria-label="Granularity">
          {GRANULARITIES.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={granularity === option.value ? 'primary' : 'secondary'}
              aria-pressed={granularity === option.value}
              onClick={() => setGranularity(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-medium text-text-secondary">Registrations</h2>
        {registrationsPending && (
          <div className="space-y-2" aria-label="Loading content" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {registrationsError && (
          <p className="mt-2 text-sm text-danger">Failed to load registrations.</p>
        )}
        {registrations && registrationsChartData.length === 0 && (
          <p className="mt-2 text-sm text-text-secondary">No data in this range.</p>
        )}
        {registrationsChartData.length > 0 && (
          <div className="mt-2 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={registrationsChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={12} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
                <Bar dataKey="count" name="Registrations" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-medium text-text-secondary">
          GGR{hasSpend ? ' vs marketing spend' : ''}
        </h2>
        {ggrPending && (
          <div className="space-y-2" aria-label="Loading content" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {ggrError && <p className="mt-2 text-sm text-danger">Failed to load GGR.</p>}
        {ggr && ggrChartData.length === 0 && (
          <p className="mt-2 text-sm text-text-secondary">No data in this range.</p>
        )}
        {ggrChartData.length > 0 && (
          <div className="mt-2 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ggrChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={12} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} />
                <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
                <Line
                  type="monotone"
                  dataKey="ggr"
                  name="GGR"
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  dot={false}
                />
                {hasSpend && (
                  <Line
                    type="monotone"
                    dataKey="spend"
                    name="Marketing spend"
                    stroke="var(--color-warning)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

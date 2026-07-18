import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '';
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

export default function AuditLogPage() {
  const {
    data: entries,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['audit-log'],
    queryFn: backendApi.listAuditLog,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit log</h1>

      <Card className="mt-4">
        {isPending && <p className="text-sm text-text-secondary">Loading audit log…</p>}
        {isError && <p className="text-sm text-danger">Failed to load audit log.</p>}
        {entries && entries.length === 0 && (
          <p className="text-sm text-text-secondary">No audit entries yet.</p>
        )}
        {entries && entries.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="py-2 font-medium">Time</th>
                <th className="py-2 font-medium">Actor</th>
                <th className="py-2 font-medium">Action</th>
                <th className="py-2 font-medium">Target</th>
                <th className="py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 whitespace-nowrap text-text-secondary">
                    {formatTimestamp(entry.createdAt)}
                  </td>
                  <td className="py-2">{entry.actorUsername}</td>
                  <td className="py-2">{entry.action}</td>
                  <td className="py-2 text-text-secondary">
                    {entry.targetType} {entry.targetId}
                  </td>
                  <td className="py-2 text-text-secondary">{formatMetadata(entry.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

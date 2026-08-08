import type { LeaderboardEntryView } from '../../lib/backendApi';

interface LeaderboardEntryRowProps {
  entry: LeaderboardEntryView;
}

/**
 * One ranked row. Every username but the viewer's own already arrives
 * masked from the backend (see maskUsername) - this just renders whichever
 * of maskedUsername/username the server actually sent, never re-derives a
 * mask client-side. The viewer's own row gets a highlight-colored border so
 * they can find themselves in a long list without it being pinned/duplicated.
 */
export function LeaderboardEntryRow({ entry }: LeaderboardEntryRowProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
        entry.isViewer ? 'border border-highlight bg-surface-2' : ''
      }`}
    >
      <span className={`w-8 shrink-0 text-center font-display text-base ${entry.rank <= 3 ? 'text-highlight' : 'text-text-secondary'}`}>
        {entry.rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {entry.isViewer ? entry.username : entry.maskedUsername}
        {entry.isViewer && <span className="ml-1.5 text-xs font-normal text-text-secondary">(you)</span>}
      </span>
      <span className="shrink-0 text-sm font-bold text-highlight">{entry.pointsTotal.toLocaleString()} pts</span>
    </div>
  );
}

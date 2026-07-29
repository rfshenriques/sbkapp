import { type ReactNode, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ChevronIcon } from '../../components/ui/ChevronIcon';

interface CampaignCardShellProps {
  name: string;
  enabled: boolean;
  summary: string;
  scheduleLine?: string | null;
  onToggleEnabled: () => void;
  isTogglingEnabled: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  /** Extra buttons rendered alongside "Delete campaign" in the footer row, e.g. "Send push for this campaign". */
  extraActions?: ReactNode;
  children: ReactNode;
}

/** Collapsible list-row wrapper shared by every campaign type's list - Live/Draft badge, name + one-line summary, enable checkbox, the type-specific form as `children`, and a delete/extra-actions footer. */
export function CampaignCardShell({
  name,
  enabled,
  summary,
  scheduleLine,
  onToggleEnabled,
  isTogglingEnabled,
  onDelete,
  isDeleting,
  extraActions,
  children,
}: CampaignCardShellProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="p-0">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              enabled ? 'bg-highlight/20 text-highlight' : 'bg-background text-text-muted'
            }`}
          >
            {enabled ? 'Live' : 'Draft'}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block text-xs text-text-secondary">{summary}</span>
            {scheduleLine && <span className="block text-xs text-text-secondary">{scheduleLine}</span>}
          </span>
        </span>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t border-border p-4 pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} disabled={isTogglingEnabled} onChange={onToggleEnabled} />
            Enabled (visible to players and eligible to grant rewards)
          </label>

          {children}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {extraActions}
            <Button variant="ghost" onClick={onDelete} disabled={isDeleting}>
              Delete campaign
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

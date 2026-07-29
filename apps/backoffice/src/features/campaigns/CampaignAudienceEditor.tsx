import { useQuery } from '@tanstack/react-query';
import * as backendApi from '../../lib/backendApi';
import type { AudienceMode } from '../../lib/backendApi';
import { AUDIENCE_MODES, audienceLabel } from './campaignFormatters';

const segmentsQueryKey = ['player-segments'] as const;

interface CampaignAudienceEditorProps {
  idPrefix: string;
  audienceMode: AudienceMode;
  segmentIds: string[];
  onAudienceModeChange: (mode: AudienceMode) => void;
  onToggleSegment: (segmentId: string) => void;
}

/** Audience-mode select + segment picker - identical shape across every campaign type (Bet & Get, Deposit, Register, Leaderboard). */
export function CampaignAudienceEditor({
  idPrefix,
  audienceMode,
  segmentIds,
  onAudienceModeChange,
  onToggleSegment,
}: CampaignAudienceEditorProps) {
  const { data: segments } = useQuery({
    queryKey: segmentsQueryKey,
    queryFn: backendApi.listPlayerSegments,
    enabled: audienceMode === 'SEGMENTS',
  });

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-sm text-text-secondary">
        Audience
        <select
          aria-label={`audience ${idPrefix}`}
          value={audienceMode}
          onChange={(event) => onAudienceModeChange(event.target.value as AudienceMode)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          {AUDIENCE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {audienceLabel(mode)}
            </option>
          ))}
        </select>
      </label>

      {audienceMode === 'SEGMENTS' && (
        <div className="flex flex-wrap gap-2">
          {(segments ?? []).length === 0 && (
            <span className="text-xs text-text-muted">No player segments exist yet.</span>
          )}
          {segments?.map((segment) => (
            <label key={segment.id} className="flex items-center gap-1 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={segmentIds.includes(segment.id)}
                onChange={() => onToggleSegment(segment.id)}
              />
              {segment.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

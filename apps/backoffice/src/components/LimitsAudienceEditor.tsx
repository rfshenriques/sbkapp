import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/Button';
import * as backendApi from '../lib/backendApi';
import type { AudienceMode, SetLimitsInput } from '../lib/backendApi';

const segmentsQueryKey = ['player-segments'] as const;

function draftToCentsOrNull(draft: string): number | null {
  return draft.trim() === '' ? null : Math.round(Number(draft) * 100);
}

function isValidAmountDraft(draft: string): boolean {
  if (draft.trim() === '') return true;
  const value = Number(draft);
  return Number.isFinite(value) && value >= 0;
}

function centsToDraft(cents: number | null): string {
  return cents === null ? '' : String(cents / 100);
}

function audienceLabel(mode: AudienceMode): string {
  switch (mode) {
    case 'ALL':
      return 'Everyone';
    case 'LOGGED_OUT':
      return 'Logged-out players only';
    case 'LOGGED_IN':
      return 'Logged-in players only';
    case 'SEGMENTS':
      return 'Specific player segments';
  }
}

const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'LOGGED_OUT', 'LOGGED_IN', 'SEGMENTS'];

export interface LimitsAudienceEditorProps {
  maxStakeCents: number | null;
  maxLiabilityCents: number | null;
  /** Running exposure so far - only rendered as a progress bar when both this and maxLiabilityCents are set. */
  currentLiabilityCents?: number;
  audienceMode: AudienceMode;
  audienceSegmentIds: string[];
  /** Whether this stays open once its match goes in-play - both boosts and manual markets auto-suspend in-play by default (see PamService), since neither has a live re-pricing feed behind it. */
  staysLiveDuringInplay: boolean;
  /** Manual markets only - omit for boosts, which have no such flag. When present, renders the "Singles only" checkbox and includes it in the save payload. */
  singlesOnly?: boolean;
  onSave: (input: SetLimitsInput) => void;
  isSaving: boolean;
  idPrefix: string;
}

export function LimitsAudienceEditor({
  maxStakeCents,
  maxLiabilityCents,
  currentLiabilityCents,
  audienceMode,
  audienceSegmentIds,
  staysLiveDuringInplay,
  singlesOnly,
  onSave,
  isSaving,
  idPrefix,
}: LimitsAudienceEditorProps) {
  const [stakeDraft, setStakeDraft] = useState(centsToDraft(maxStakeCents));
  const [liabilityDraft, setLiabilityDraft] = useState(centsToDraft(maxLiabilityCents));
  const [mode, setMode] = useState<AudienceMode>(audienceMode);
  const [segmentIds, setSegmentIds] = useState<string[]>(audienceSegmentIds);
  const [staysLive, setStaysLive] = useState(staysLiveDuringInplay);
  const [singlesOnlyState, setSinglesOnlyState] = useState(singlesOnly ?? false);

  const { data: segments } = useQuery({
    queryKey: segmentsQueryKey,
    queryFn: backendApi.listPlayerSegments,
    enabled: mode === 'SEGMENTS',
  });

  const stakeValid = isValidAmountDraft(stakeDraft);
  const liabilityValid = isValidAmountDraft(liabilityDraft);
  const canSave = stakeValid && liabilityValid;

  function toggleSegment(segmentId: string) {
    setSegmentIds((prev) =>
      prev.includes(segmentId) ? prev.filter((id) => id !== segmentId) : [...prev, segmentId],
    );
  }

  function handleSave() {
    if (!canSave) return;
    onSave({
      maxStakeCents: draftToCentsOrNull(stakeDraft),
      maxLiabilityCents: draftToCentsOrNull(liabilityDraft),
      audienceMode: mode,
      segmentIds: mode === 'SEGMENTS' ? segmentIds : [],
      staysLiveDuringInplay: staysLive,
      ...(singlesOnly !== undefined ? { singlesOnly: singlesOnlyState } : {}),
    });
  }

  const showLiabilityBar = currentLiabilityCents !== undefined && maxLiabilityCents !== null && maxLiabilityCents > 0;
  const liabilityPercent = showLiabilityBar
    ? Math.min(100, Math.round(((currentLiabilityCents ?? 0) / (maxLiabilityCents ?? 1)) * 100))
    : 0;

  return (
    <div className="space-y-2 rounded-md bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-text-secondary">
          Max stake
          <input
            type="text"
            inputMode="decimal"
            placeholder="No cap"
            aria-label={`${idPrefix} max stake`}
            value={stakeDraft}
            onChange={(event) => setStakeDraft(event.target.value)}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary">
          Max liability
          <input
            type="text"
            inputMode="decimal"
            placeholder="No cap"
            aria-label={`${idPrefix} max liability`}
            value={liabilityDraft}
            onChange={(event) => setLiabilityDraft(event.target.value)}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary">
          Audience
          <select
            aria-label={`${idPrefix} audience`}
            value={mode}
            onChange={(event) => setMode(event.target.value as AudienceMode)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
          >
            {AUDIENCE_MODES.map((audienceMode) => (
              <option key={audienceMode} value={audienceMode}>
                {audienceLabel(audienceMode)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            aria-label={`${idPrefix} will be live`}
            checked={staysLive}
            onChange={(event) => setStaysLive(event.target.checked)}
          />
          Will be live (stays open once the match goes in-play)
        </label>
        {singlesOnly !== undefined && (
          <label className="flex items-center gap-1.5 text-sm text-text-secondary">
            <input
              type="checkbox"
              aria-label={`${idPrefix} singles only`}
              checked={singlesOnlyState}
              onChange={(event) => setSinglesOnlyState(event.target.checked)}
            />
            Singles only (can't be combined in an accumulator)
          </label>
        )}
        <Button variant="secondary" disabled={!canSave || isSaving} onClick={handleSave}>
          Save
        </Button>
      </div>

      {mode === 'SEGMENTS' && (
        <div className="flex flex-wrap gap-2">
          {(segments ?? []).length === 0 && (
            <span className="text-xs text-text-muted">No player segments exist yet.</span>
          )}
          {segments?.map((segment) => (
            <label key={segment.id} className="flex items-center gap-1 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={segmentIds.includes(segment.id)}
                onChange={() => toggleSegment(segment.id)}
              />
              {segment.name}
            </label>
          ))}
        </div>
      )}

      {showLiabilityBar && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
            <span>Liability used</span>
            <span>
              €{((currentLiabilityCents ?? 0) / 100).toFixed(2)} / €{((maxLiabilityCents ?? 0) / 100).toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full ${liabilityPercent >= 100 ? 'bg-danger' : 'bg-highlight'}`}
              style={{ width: `${liabilityPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

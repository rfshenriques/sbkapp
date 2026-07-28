import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import { toast, errorMessage } from '../features/toast/toastStore';
import * as backendApi from '../lib/backendApi';

const segmentsQueryKey = ['player-segments'] as const;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function NewSegmentForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => backendApi.createPlayerSegment(name.trim(), description.trim() || undefined),
    onSuccess: () => {
      setName('');
      setDescription('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: segmentsQueryKey });
      toast.success('Segment created');
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      toast.error(errorMessage(mutationError, 'Failed to create segment'));
    },
  });

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">New segment</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Segment name (e.g. High rollers)"
          aria-label="Segment name"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description (optional)"
          aria-label="Segment description"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <Button
          variant="primary"
          disabled={name.trim() === '' || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Create
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}

/** Always-visible dot showing the segment's current color (or an empty ring when unset), plus the editable hex input + Save button, matching TeamColorRow's identical swatch/input/Save pattern. */
function SegmentColorPicker({ segment }: { segment: backendApi.PlayerSegment }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(segment.colorHex ?? '');

  const setColorMutation = useMutation({
    mutationFn: (colorHex: string | null) => backendApi.setPlayerSegmentColor(segment.id, colorHex),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: segmentsQueryKey });
      toast.success('Segment color saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save segment color')),
  });

  const isValid = draft === '' || HEX_COLOR_PATTERN.test(draft);
  const isDirty = draft !== (segment.colorHex ?? '');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="h-5 w-5 shrink-0 rounded-full border border-border"
        style={{ backgroundColor: HEX_COLOR_PATTERN.test(draft) ? draft : 'transparent' }}
        aria-hidden="true"
      />
      <input
        type="text"
        aria-label={`${segment.name} color hex`}
        placeholder="#EF0107"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="w-28 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary"
      />
      {!isValid && <span className="text-xs text-danger">Invalid hex</span>}
      <Button
        variant="secondary"
        disabled={!isValid || !isDirty || setColorMutation.isPending}
        onClick={() => setColorMutation.mutate(draft === '' ? null : draft)}
      >
        Save
      </Button>
    </div>
  );
}

function SegmentCard({ segment }: { segment: backendApi.PlayerSegment }) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addMemberMutation = useMutation({
    mutationFn: () => backendApi.addPlayerSegmentMember(segment.id, identifier.trim()),
    onSuccess: () => {
      setIdentifier('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: segmentsQueryKey });
      toast.success('Player added to segment');
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      toast.error(errorMessage(mutationError, 'Failed to add player'));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => backendApi.removePlayerSegmentMember(segment.id, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: segmentsQueryKey });
      toast.success('Player removed from segment');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove player')),
  });

  const removeSegmentMutation = useMutation({
    mutationFn: () => backendApi.removePlayerSegment(segment.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: segmentsQueryKey });
      toast.success('Segment removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove segment')),
  });

  return (
    <Card className="p-0">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full border border-border"
            style={{ backgroundColor: segment.colorHex ?? 'transparent' }}
            aria-label={segment.colorHex ? `${segment.name} color` : `${segment.name} has no color set`}
          />
          <span>
            <span className="text-sm font-semibold">
              {segment.name} <span className="text-text-muted">({segment.members.length})</span>
            </span>
            {segment.description && <span className="block text-xs text-text-secondary">{segment.description}</span>}
          </span>
        </span>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="space-y-3 border-t border-border p-4 pt-3">
          <SegmentColorPicker segment={segment} />

          {segment.members.length === 0 && (
            <p className="text-sm text-text-secondary">No players in this segment yet.</p>
          )}
          {segment.members.length > 0 && (
            <div className="space-y-1">
              {segment.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    {member.user.username} <span className="text-text-muted">({member.user.email})</span>
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => removeMemberMutation.mutate(member.userId)}
                    disabled={removeMemberMutation.isPending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Player email or username"
              aria-label={`Add player to ${segment.name}`}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <Button
              variant="secondary"
              disabled={identifier.trim() === '' || addMemberMutation.isPending}
              onClick={() => addMemberMutation.mutate()}
            >
              Add player
            </Button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="border-t border-border pt-3">
            <Button
              variant="ghost"
              onClick={() => removeSegmentMutation.mutate()}
              disabled={removeSegmentMutation.isPending}
            >
              Delete segment
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function PlayerSegmentsPage() {
  const {
    data: segments,
    isPending,
    isError,
  } = useQuery({ queryKey: segmentsQueryKey, queryFn: backendApi.listPlayerSegments });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Player segments</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Named groups of players, added manually by email or username. Used to target manual markets and
        boosts to a subset of players (see each one's audience setting) - membership rules beyond manual
        add/remove are a later CRM automation, not built here.
      </p>

      <div className="mt-4 space-y-4">
        <NewSegmentForm />

        {isPending && (
          <div className="space-y-2" aria-label="Loading segments" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load player segments.</p>}
        {!isPending && segments?.length === 0 && (
          <p className="text-sm text-text-secondary">No segments yet - create one above.</p>
        )}
        <div className="space-y-2">
          {segments?.map((segment) => (
            <SegmentCard key={segment.id} segment={segment} />
          ))}
        </div>
      </div>
    </div>
  );
}

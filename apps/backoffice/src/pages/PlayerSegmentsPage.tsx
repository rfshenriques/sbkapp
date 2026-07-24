import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import * as backendApi from '../lib/backendApi';

const segmentsQueryKey = ['player-segments'] as const;

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
    },
    onError: (mutationError: Error) => setError(mutationError.message),
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
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => backendApi.removePlayerSegmentMember(segment.id, userId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: segmentsQueryKey }),
  });

  const removeSegmentMutation = useMutation({
    mutationFn: () => backendApi.removePlayerSegment(segment.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: segmentsQueryKey }),
  });

  return (
    <Card className="p-0">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span>
          <span className="text-sm font-semibold">
            {segment.name} <span className="text-text-muted">({segment.members.length})</span>
          </span>
          {segment.description && <span className="block text-xs text-text-secondary">{segment.description}</span>}
        </span>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="space-y-3 border-t border-border p-4 pt-3">
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

        {isPending && <p className="text-sm text-text-secondary">Loading segments…</p>}
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

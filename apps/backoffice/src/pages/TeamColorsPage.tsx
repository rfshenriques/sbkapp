import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const teamColorsQueryKey = ['team-colors'] as const;
const matchesQueryKey = ['live-matches'] as const;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function TeamColorRow({ teamColor }: { teamColor: backendApi.TeamColor }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(teamColor.colorHex ?? '');

  const setColorMutation = useMutation({
    mutationFn: (colorHex: string | null) => backendApi.setTeamColor(teamColor.id, colorHex),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: teamColorsQueryKey }),
  });

  const isValid = draft === '' || HEX_COLOR_PATTERN.test(draft);
  const isDirty = draft !== (teamColor.colorHex ?? '');

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
      <span className="text-sm">{teamColor.name}</span>
      <div className="flex items-center gap-2">
        <span
          className="h-5 w-5 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: HEX_COLOR_PATTERN.test(draft) ? draft : 'transparent' }}
          aria-hidden="true"
        />
        <input
          type="text"
          aria-label={`${teamColor.name} color hex`}
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
    </div>
  );
}

export default function TeamColorsPage() {
  const queryClient = useQueryClient();
  const [hasSynced, setHasSynced] = useState(false);

  const { data: matches } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const {
    data: teamColors,
    isPending: teamColorsPending,
    isError: teamColorsError,
  } = useQuery({ queryKey: teamColorsQueryKey, queryFn: backendApi.listTeamColors });

  const syncMutation = useMutation({
    mutationFn: backendApi.syncTeamNames,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: teamColorsQueryKey }),
  });

  useEffect(() => {
    if (!matches || matches.length === 0 || hasSynced) {
      return;
    }
    const names = [...new Set(matches.flatMap((match) => [match.homeTeam, match.awayTeam]))];
    syncMutation.mutate(names);
    setHasSynced(true);
  }, [matches, hasSynced]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Team colors</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Teams seen in the live odds feed are listed here automatically. Set each team's real color so
        the player app can show it.
      </p>

      <div className="mt-4 space-y-2">
        {teamColorsPending && <p className="text-sm text-text-secondary">Loading team colors…</p>}
        {teamColorsError && <p className="text-sm text-danger">Failed to load team colors.</p>}
        {teamColors?.length === 0 && (
          <p className="text-sm text-text-secondary">
            No teams yet - they'll appear here once matches are live.
          </p>
        )}

        {teamColors && teamColors.length > 0 && (
          <Card className="space-y-2">
            {teamColors.map((teamColor) => (
              <TeamColorRow key={teamColor.id} teamColor={teamColor} />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import { teamCountryMap } from '../lib/countryMaps';
import { groupByLetter } from '../lib/groupByLetter';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const teamColorsQueryKey = ['team-colors'] as const;
const matchesQueryKey = ['live-matches'] as const;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Teams with no country evidence in the currently-loaded match feed. */
const UNKNOWN_COUNTRY = 'Unknown';

type GroupMode = 'letter' | 'country';

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

interface Group {
  key: string;
  label: string;
  teamColors: backendApi.TeamColor[];
}

function groupByCountry(teamColors: backendApi.TeamColor[], byCountry: Map<string, string>): Group[] {
  const map = new Map<string, backendApi.TeamColor[]>();
  for (const teamColor of teamColors) {
    const country = byCountry.get(teamColor.name) ?? UNKNOWN_COUNTRY;
    const bucket = map.get(country) ?? [];
    bucket.push(teamColor);
    map.set(country, bucket);
  }
  return Array.from(map.entries())
    .map(([key, bucket]) => ({ key, label: key, teamColors: bucket }))
    .sort((a, b) => {
      if (a.key === UNKNOWN_COUNTRY) return 1;
      if (b.key === UNKNOWN_COUNTRY) return -1;
      return a.key.localeCompare(b.key);
    });
}

export default function TeamColorsPage() {
  const queryClient = useQueryClient();
  const [hasSynced, setHasSynced] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>('letter');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

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

  const byCountry = useMemo(() => teamCountryMap(matches ?? []), [matches]);

  const groups = useMemo(() => {
    if (!teamColors) return [];
    return groupMode === 'letter'
      ? groupByLetter(teamColors, (teamColor) => teamColor.name).map((group) => ({
          key: group.key,
          label: group.label,
          teamColors: group.items,
        }))
      : groupByCountry(teamColors, byCountry);
  }, [teamColors, groupMode, byCountry]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Team colors</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Teams seen in the live odds feed are listed here automatically. Set each team's real color so
        the player app can show it.
      </p>

      {teamColors && teamColors.length > 0 && (
        <div className="mt-4 flex gap-2" role="group" aria-label="Group by">
          <Button
            variant={groupMode === 'letter' ? 'primary' : 'secondary'}
            aria-pressed={groupMode === 'letter'}
            onClick={() => {
              setGroupMode('letter');
              setExpandedGroup(null);
            }}
          >
            By letter
          </Button>
          <Button
            variant={groupMode === 'country' ? 'primary' : 'secondary'}
            aria-pressed={groupMode === 'country'}
            onClick={() => {
              setGroupMode('country');
              setExpandedGroup(null);
            }}
          >
            By country
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {teamColorsPending && <p className="text-sm text-text-secondary">Loading team colors…</p>}
        {teamColorsError && <p className="text-sm text-danger">Failed to load team colors.</p>}
        {teamColors?.length === 0 && (
          <p className="text-sm text-text-secondary">
            No teams yet - they'll appear here once matches are live.
          </p>
        )}

        {groups.map((group) => {
          const isExpanded = expandedGroup === group.key;
          return (
            <Card key={group.key} className="p-0">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold">
                  {group.label} <span className="text-text-muted">({group.teamColors.length})</span>
                </span>
                <ChevronIcon className={`h-4 w-4 shrink-0 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isExpanded && (
                <div className="space-y-2 border-t border-border p-4 pt-3">
                  {group.teamColors.map((teamColor) => (
                    <TeamColorRow key={teamColor.id} teamColor={teamColor} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

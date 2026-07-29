import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Match } from '@sportsbook/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { toast, errorMessage } from '../toast/toastStore';
import * as backendApi from '../../lib/backendApi';
import type { AudienceMode } from '../../lib/backendApi';
import { formatScheduleWindow, isoToLocalInputValue, localInputValueToIso } from '../../lib/dateTimeInput';
import * as oddsEngineApi from '../../lib/oddsEngineApi';
import { CampaignAudienceEditor } from './CampaignAudienceEditor';
import { CampaignCardShell } from './CampaignCardShell';
import { CampaignScheduleFields } from './CampaignScheduleFields';
import { CampaignScopeEditor } from './CampaignScopeEditor';
import { LeaderboardRewardTierEditor } from './LeaderboardRewardTierEditor';
import { centsToDisplay } from './campaignFormatters';

const campaignsQueryKey = ['leaderboard-campaigns'] as const;
const matchesQueryKey = ['live-matches'] as const;

function NewCampaignForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [pointsPerEuro, setPointsPerEuro] = useState('1');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      backendApi.createLeaderboardCampaign({
        name: name.trim(),
        pointsPerEuroStaked: Number(pointsPerEuro),
        startAt: localInputValueToIso(startAt),
        endAt: localInputValueToIso(endAt)!,
      }),
    onSuccess: () => {
      setName('');
      setPointsPerEuro('1');
      setStartAt('');
      setEndAt('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success('Campaign created');
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      toast.error(errorMessage(mutationError, 'Failed to create campaign'));
    },
  });

  const isValid = name.trim() !== '' && Number(pointsPerEuro) > 0 && endAt !== '';

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">New Leaderboard campaign</h2>
      <p className="text-xs text-text-secondary">
        Players opt in ("participate"), earn points from qualifying bets, and get ranked automatically. Unlike other
        campaign types, an end date is required - ranking and prize-granting both need a definite close. Created
        disabled - configure conditions, scope, and reward tiers below, then enable it when ready.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Campaign name (e.g. Weekly Leaderboard)"
          aria-label="Campaign name"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-text-secondary">
          Points per €1 staked
          <input
            type="text"
            inputMode="decimal"
            value={pointsPerEuro}
            onChange={(event) => setPointsPerEuro(event.target.value)}
            aria-label="Points per euro staked"
            className="w-16 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <Button variant="primary" disabled={!isValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
          Create
        </Button>
      </div>
      <CampaignScheduleFields
        idPrefix="new-leaderboard-campaign"
        startAtValue={startAt}
        endAtValue={endAt}
        onStartAtChange={setStartAt}
        onEndAtChange={setEndAt}
        endAtRequired
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}

interface CampaignDetailsFormProps {
  campaign: backendApi.LeaderboardCampaign;
}

function CampaignDetailsForm({ campaign }: CampaignDetailsFormProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<backendApi.UpdateLeaderboardCampaignPayload>({
    ...campaign,
    segmentIds: campaign.segments.map((segment) => segment.segmentId),
  });

  const [pointsPerEuroText, setPointsPerEuroText] = useState(campaign.pointsPerEuroStaked.toString());
  const [minStakeText, setMinStakeText] = useState(campaign.minStakeCents != null ? centsToDisplay(campaign.minStakeCents) : '');
  const [minOddsText, setMinOddsText] = useState(campaign.minOddsPerLeg?.toString() ?? '');
  const [minCombinedOddsText, setMinCombinedOddsText] = useState(campaign.minCombinedOdds?.toString() ?? '');
  const [minSelectionsText, setMinSelectionsText] = useState(campaign.minSelections?.toString() ?? '');
  const [startAtText, setStartAtText] = useState(isoToLocalInputValue(campaign.startAt));
  const [endAtText, setEndAtText] = useState(isoToLocalInputValue(campaign.endAt));

  useEffect(() => {
    setDraft({ ...campaign, segmentIds: campaign.segments.map((segment) => segment.segmentId) });
    setPointsPerEuroText(campaign.pointsPerEuroStaked.toString());
    setMinStakeText(campaign.minStakeCents != null ? centsToDisplay(campaign.minStakeCents) : '');
    setMinOddsText(campaign.minOddsPerLeg?.toString() ?? '');
    setMinCombinedOddsText(campaign.minCombinedOdds?.toString() ?? '');
    setMinSelectionsText(campaign.minSelections?.toString() ?? '');
    setStartAtText(isoToLocalInputValue(campaign.startAt));
    setEndAtText(isoToLocalInputValue(campaign.endAt));
  }, [campaign]);

  const saveMutation = useMutation({
    mutationFn: () => backendApi.updateLeaderboardCampaign(campaign.id, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success('Campaign saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save campaign')),
  });

  function toggleSegment(segmentId: string) {
    setDraft((previous) => {
      const current = previous.segmentIds ?? [];
      return {
        ...previous,
        segmentIds: current.includes(segmentId) ? current.filter((id) => id !== segmentId) : [...current, segmentId],
      };
    });
  }

  const isValid = (draft.name ?? '').trim() !== '' && typeof draft.pointsPerEuroStaked === 'number' && draft.pointsPerEuroStaked > 0 && !!draft.endAt;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-text-secondary" htmlFor={`name-${campaign.id}`}>
          Name
        </label>
        <input
          id={`name-${campaign.id}`}
          type="text"
          value={draft.name ?? ''}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-text-secondary" htmlFor={`description-${campaign.id}`}>
          Description (shown to players)
        </label>
        <input
          id={`description-${campaign.id}`}
          type="text"
          value={draft.description ?? ''}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>

      <CampaignScheduleFields
        idPrefix={campaign.id}
        startAtValue={startAtText}
        endAtValue={endAtText}
        onStartAtChange={(value) => {
          setStartAtText(value);
          setDraft({ ...draft, startAt: localInputValueToIso(value) });
        }}
        onEndAtChange={(value) => {
          setEndAtText(value);
          setDraft({ ...draft, endAt: localInputValueToIso(value) ?? undefined });
        }}
        endAtRequired
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`points-per-euro-${campaign.id}`}>
            Points per €1 staked
          </label>
          <input
            id={`points-per-euro-${campaign.id}`}
            type="text"
            inputMode="decimal"
            value={pointsPerEuroText}
            onChange={(event) => {
              setPointsPerEuroText(event.target.value);
              setDraft({ ...draft, pointsPerEuroStaked: Number(event.target.value) });
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <label className="mt-1 flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={draft.useCombinedOddsAsMultiplier ?? false}
            onChange={(event) => setDraft({ ...draft, useCombinedOddsAsMultiplier: event.target.checked })}
          />
          Multiply by combined odds
        </label>
        <label className="mt-1 flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={draft.onlySettledWonCounts ?? true}
            onChange={(event) => setDraft({ ...draft, onlySettledWonCounts: event.target.checked })}
          />
          Only WON bets count
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`min-stake-${campaign.id}`}>
            Min stake (£)
          </label>
          <input
            id={`min-stake-${campaign.id}`}
            type="text"
            inputMode="decimal"
            value={minStakeText}
            placeholder="No minimum"
            onChange={(event) => {
              setMinStakeText(event.target.value);
              setDraft({ ...draft, minStakeCents: event.target.value === '' ? null : Math.round(Number(event.target.value) * 100) });
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`min-odds-${campaign.id}`}>
            Min odds/leg
          </label>
          <input
            id={`min-odds-${campaign.id}`}
            type="text"
            inputMode="decimal"
            value={minOddsText}
            placeholder="No minimum"
            onChange={(event) => {
              setMinOddsText(event.target.value);
              setDraft({ ...draft, minOddsPerLeg: event.target.value === '' ? null : Number(event.target.value) });
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`min-combined-odds-${campaign.id}`}>
            Min combined odds
          </label>
          <input
            id={`min-combined-odds-${campaign.id}`}
            type="text"
            inputMode="decimal"
            value={minCombinedOddsText}
            placeholder="No minimum"
            onChange={(event) => {
              setMinCombinedOddsText(event.target.value);
              setDraft({ ...draft, minCombinedOdds: event.target.value === '' ? null : Number(event.target.value) });
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`bet-type-${campaign.id}`}>
            Bet type
          </label>
          <select
            id={`bet-type-${campaign.id}`}
            value={draft.betType ?? 'EITHER'}
            onChange={(event) => setDraft({ ...draft, betType: event.target.value as backendApi.BetAndGetBetType })}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="EITHER">Either</option>
            <option value="SINGLES_ONLY">Singles only</option>
            <option value="ACCUMULATOR_ONLY">Accumulator only</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`min-selections-${campaign.id}`}>
            Min selections
          </label>
          <input
            id={`min-selections-${campaign.id}`}
            type="text"
            inputMode="numeric"
            value={minSelectionsText}
            placeholder="No minimum"
            disabled={draft.betType === 'SINGLES_ONLY'}
            onChange={(event) => {
              setMinSelectionsText(event.target.value);
              setDraft({ ...draft, minSelections: event.target.value === '' ? null : Number(event.target.value) });
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`betting-timing-${campaign.id}`}>
            Betting timing
          </label>
          <select
            id={`betting-timing-${campaign.id}`}
            value={draft.bettingTiming ?? 'EITHER'}
            onChange={(event) => setDraft({ ...draft, bettingTiming: event.target.value as backendApi.BetAndGetTiming })}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="EITHER">Either</option>
            <option value="PREMATCH_ONLY">Prematch only</option>
            <option value="INPLAY_ONLY">In-play only</option>
          </select>
        </div>
      </div>

      <CampaignAudienceEditor
        idPrefix={campaign.id}
        audienceMode={draft.audienceMode ?? 'ALL'}
        segmentIds={draft.segmentIds ?? []}
        onAudienceModeChange={(mode) => setDraft({ ...draft, audienceMode: mode as AudienceMode })}
        onToggleSegment={toggleSegment}
      />

      <Button variant="secondary" disabled={!isValid || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        Save details
      </Button>
    </div>
  );
}

interface CampaignCardProps {
  campaign: backendApi.LeaderboardCampaign;
  matches: Match[] | undefined;
  matchesLoading: boolean;
  matchesError: boolean;
}

function CampaignCard({ campaign, matches, matchesLoading, matchesError }: CampaignCardProps) {
  const queryClient = useQueryClient();
  const [showEntries, setShowEntries] = useState(false);

  const toggleEnabledMutation = useMutation({
    mutationFn: () => backendApi.updateLeaderboardCampaign(campaign.id, { enabled: !campaign.enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success(campaign.enabled ? 'Campaign disabled' : 'Campaign enabled');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update campaign')),
  });

  const setScopesMutation = useMutation({
    mutationFn: (scopes: { scopeType: backendApi.BetAndGetScopeType; scopeValue: string }[]) =>
      backendApi.setLeaderboardCampaignScopes(campaign.id, scopes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success('Scope saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save scope')),
  });

  const setRewardTiersMutation = useMutation({
    mutationFn: (tiers: { rankFrom: number; rankTo: number; rewardAmountCents: number }[]) =>
      backendApi.setLeaderboardRewardTiers(campaign.id, tiers),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success('Reward tiers saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save reward tiers')),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => backendApi.finalizeLeaderboardCampaign(campaign.id),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success(updated.prizesGrantedAt ? 'Prizes granted' : "Campaign hasn't ended yet - nothing to grant");
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to finalize campaign')),
  });

  const removeMutation = useMutation({
    mutationFn: () => backendApi.removeLeaderboardCampaign(campaign.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success('Campaign removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove campaign')),
  });

  const { data: entries } = useQuery({
    queryKey: ['leaderboard-campaign-entries', campaign.id],
    queryFn: () => backendApi.getLeaderboardCampaignEntries(campaign.id),
    enabled: showEntries,
  });

  const hasEnded = new Date(campaign.endAt) < new Date();

  return (
    <CampaignCardShell
      name={campaign.name}
      enabled={campaign.enabled}
      summary={`${campaign.pointsPerEuroStaked} pt/€1${campaign.useCombinedOddsAsMultiplier ? ' × odds' : ''} · ${campaign.scopes.length} scope ${campaign.scopes.length === 1 ? 'entry' : 'entries'} · ${campaign.rewardTiers.length} reward ${campaign.rewardTiers.length === 1 ? 'tier' : 'tiers'}`}
      scheduleLine={formatScheduleWindow(campaign)}
      onToggleEnabled={() => toggleEnabledMutation.mutate()}
      isTogglingEnabled={toggleEnabledMutation.isPending}
      onDelete={() => removeMutation.mutate()}
      isDeleting={removeMutation.isPending}
      extraActions={
        <>
          <Button variant="secondary" onClick={() => setShowEntries((value) => !value)}>
            {showEntries ? 'Hide entries' : 'View entries'}
          </Button>
          <Button
            variant="secondary"
            disabled={!hasEnded || campaign.prizesGrantedAt !== null || finalizeMutation.isPending}
            onClick={() => finalizeMutation.mutate()}
          >
            {campaign.prizesGrantedAt ? 'Prizes granted' : 'Finalize & grant prizes'}
          </Button>
        </>
      }
    >
      <CampaignDetailsForm campaign={campaign} />

      <div className="border-t border-border pt-3">
        <CampaignScopeEditor
          idPrefix={campaign.id}
          initialScopes={campaign.scopes.map(({ scopeType, scopeValue }) => ({ scopeType, scopeValue }))}
          onSave={(scopes) => setScopesMutation.mutate(scopes)}
          isSaving={setScopesMutation.isPending}
          matches={matches}
          matchesLoading={matchesLoading}
          matchesError={matchesError}
        />
      </div>

      <div className="border-t border-border pt-3">
        <LeaderboardRewardTierEditor
          idPrefix={campaign.id}
          tiers={campaign.rewardTiers.map(({ rankFrom, rankTo, rewardAmountCents }) => ({ rankFrom, rankTo, rewardAmountCents }))}
          onSave={(tiers) => setRewardTiersMutation.mutate(tiers)}
          isSaving={setRewardTiersMutation.isPending}
        />
      </div>

      {showEntries && (
        <div className="border-t border-border pt-3">
          <span className="block text-xs text-text-secondary">Ranked entries (unmasked - staff view)</span>
          {entries?.length === 0 && <p className="mt-1 text-sm text-text-secondary">No one has joined yet.</p>}
          {entries && entries.length > 0 && (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-secondary">
                  <th className="pb-1">Rank</th>
                  <th className="pb-1">Player</th>
                  <th className="pb-1">Points</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id} className="border-t border-border">
                    <td className="py-1.5">#{index + 1}</td>
                    <td className="py-1.5">{entry.user.username}</td>
                    <td className="py-1.5">{entry.pointsTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </CampaignCardShell>
  );
}

export function LeaderboardCampaignsTab() {
  const { data: campaigns, isPending, isError } = useQuery({
    queryKey: campaignsQueryKey,
    queryFn: backendApi.listLeaderboardCampaigns,
  });

  const { data: matches, isPending: matchesLoading, isError: matchesError } = useQuery({
    queryKey: matchesQueryKey,
    queryFn: oddsEngineApi.fetchMatches,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Players opt in and earn points from qualifying bets per a configurable formula, ranked live. Configure
        optional rank-based freebet reward tiers - granted automatically once the leaderboard ends (or via the
        "Finalize & grant prizes" button once it has).
      </p>

      <NewCampaignForm />

      {isPending && (
        <div className="space-y-2" aria-label="Loading campaigns" role="status">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      {isError && <p className="text-sm text-danger">Failed to load Leaderboard campaigns.</p>}
      {!isPending && campaigns?.length === 0 && <p className="text-sm text-text-secondary">No campaigns yet - create one above.</p>}

      <div className="space-y-2">
        {campaigns?.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} matches={matches} matchesLoading={matchesLoading} matchesError={matchesError} />
        ))}
      </div>
    </div>
  );
}

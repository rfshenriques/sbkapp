import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import { centsToDisplay, displayToCents } from './campaignFormatters';

const campaignsQueryKey = ['bet-and-get-campaigns'] as const;
const matchesQueryKey = ['live-matches'] as const;

const DEFAULT_REWARD_AMOUNT = '10.00';
const DEFAULT_REWARD_PERCENT = '10';
const DEFAULT_REWARD_CAP = '50.00';

function NewCampaignForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [rewardType, setRewardType] = useState<backendApi.BetAndGetRewardType>('FIXED');
  const [rewardAmount, setRewardAmount] = useState(DEFAULT_REWARD_AMOUNT);
  const [rewardPercent, setRewardPercent] = useState(DEFAULT_REWARD_PERCENT);
  const [rewardCap, setRewardCap] = useState(DEFAULT_REWARD_CAP);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      backendApi.createBetAndGetCampaign({
        name: name.trim(),
        rewardType,
        startAt: localInputValueToIso(startAt),
        endAt: localInputValueToIso(endAt),
        ...(rewardType === 'FIXED'
          ? { rewardAmountCents: displayToCents(rewardAmount) }
          : { rewardPercent: Number(rewardPercent), rewardCapCents: displayToCents(rewardCap) }),
      }),
    onSuccess: () => {
      setName('');
      setRewardType('FIXED');
      setRewardAmount(DEFAULT_REWARD_AMOUNT);
      setRewardPercent(DEFAULT_REWARD_PERCENT);
      setRewardCap(DEFAULT_REWARD_CAP);
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

  const rewardValid =
    rewardType === 'FIXED'
      ? Number.isFinite(displayToCents(rewardAmount)) && displayToCents(rewardAmount) > 0
      : Number(rewardPercent) > 0 && Number.isFinite(displayToCents(rewardCap)) && displayToCents(rewardCap) > 0;

  const isValid = name.trim() !== '' && rewardValid;

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">New Bet & Get campaign</h2>
      <p className="text-xs text-text-secondary">
        Created disabled - configure conditions, scope, and reward below, then enable it when it's ready to go live.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Campaign name (e.g. Champions League Bet & Get)"
          aria-label="Campaign name"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          aria-label="Reward type"
          value={rewardType}
          onChange={(event) => setRewardType(event.target.value as backendApi.BetAndGetRewardType)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="FIXED">Fixed amount</option>
          <option value="PERCENTAGE">% of stake</option>
        </select>
        {rewardType === 'FIXED' ? (
          <div className="flex items-center gap-1">
            <span className="text-sm text-text-secondary">£</span>
            <input
              type="text"
              inputMode="decimal"
              value={rewardAmount}
              onChange={(event) => setRewardAmount(event.target.value)}
              aria-label="Reward amount"
              className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <>
            <label className="flex items-center gap-1.5 text-sm text-text-secondary">
              Percent
              <input
                type="text"
                inputMode="decimal"
                value={rewardPercent}
                onChange={(event) => setRewardPercent(event.target.value)}
                aria-label="Reward percent"
                className="w-16 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-text-secondary">
              Cap
              <span className="flex items-center gap-1">
                <span>£</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rewardCap}
                  onChange={(event) => setRewardCap(event.target.value)}
                  aria-label="Reward cap"
                  className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </span>
            </label>
          </>
        )}
        <Button variant="primary" disabled={!isValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
          Create
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <CampaignScheduleFields
          idPrefix="new-bag-campaign"
          startAtValue={startAt}
          endAtValue={endAt}
          onStartAtChange={setStartAt}
          onEndAtChange={setEndAt}
        />
        <p className="text-xs text-text-secondary">
          Leave either blank to run with no boundary on that side - enabling still requires the checkbox below.
        </p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}

interface CampaignDetailsFormProps {
  campaign: backendApi.BetAndGetCampaign;
}

function CampaignDetailsForm({ campaign }: CampaignDetailsFormProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<backendApi.UpdateBetAndGetCampaignPayload>({
    ...campaign,
    segmentIds: campaign.segments.map((segment) => segment.segmentId),
  });

  const [rewardAmountText, setRewardAmountText] = useState(
    campaign.rewardAmountCents != null ? centsToDisplay(campaign.rewardAmountCents) : '',
  );
  const [rewardPercentText, setRewardPercentText] = useState(campaign.rewardPercent?.toString() ?? '');
  const [rewardCapText, setRewardCapText] = useState(
    campaign.rewardCapCents != null ? centsToDisplay(campaign.rewardCapCents) : '',
  );
  const [minStakeText, setMinStakeText] = useState(campaign.minStakeCents != null ? centsToDisplay(campaign.minStakeCents) : '');
  const [minOddsText, setMinOddsText] = useState(campaign.minOddsPerLeg?.toString() ?? '');
  const [minCombinedOddsText, setMinCombinedOddsText] = useState(campaign.minCombinedOdds?.toString() ?? '');
  const [minSelectionsText, setMinSelectionsText] = useState(campaign.minSelections?.toString() ?? '');
  const [maxRedemptionsText, setMaxRedemptionsText] = useState(campaign.maxRedemptionsPerPlayer?.toString() ?? '');
  const [startAtText, setStartAtText] = useState(isoToLocalInputValue(campaign.startAt));
  const [endAtText, setEndAtText] = useState(isoToLocalInputValue(campaign.endAt));

  function toggleSegment(segmentId: string) {
    setDraft((previous) => {
      const current = previous.segmentIds ?? [];
      return {
        ...previous,
        segmentIds: current.includes(segmentId) ? current.filter((id) => id !== segmentId) : [...current, segmentId],
      };
    });
  }

  useEffect(() => {
    setDraft({ ...campaign, segmentIds: campaign.segments.map((segment) => segment.segmentId) });
    setRewardAmountText(campaign.rewardAmountCents != null ? centsToDisplay(campaign.rewardAmountCents) : '');
    setRewardPercentText(campaign.rewardPercent?.toString() ?? '');
    setRewardCapText(campaign.rewardCapCents != null ? centsToDisplay(campaign.rewardCapCents) : '');
    setMinStakeText(campaign.minStakeCents != null ? centsToDisplay(campaign.minStakeCents) : '');
    setMinOddsText(campaign.minOddsPerLeg?.toString() ?? '');
    setMinCombinedOddsText(campaign.minCombinedOdds?.toString() ?? '');
    setMinSelectionsText(campaign.minSelections?.toString() ?? '');
    setMaxRedemptionsText(campaign.maxRedemptionsPerPlayer?.toString() ?? '');
    setStartAtText(isoToLocalInputValue(campaign.startAt));
    setEndAtText(isoToLocalInputValue(campaign.endAt));
  }, [campaign]);

  const saveMutation = useMutation({
    mutationFn: () => backendApi.updateBetAndGetCampaign(campaign.id, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success('Campaign saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save campaign')),
  });

  const rewardValid =
    draft.rewardType === 'PERCENTAGE'
      ? typeof draft.rewardPercent === 'number' &&
        draft.rewardPercent > 0 &&
        typeof draft.rewardCapCents === 'number' &&
        draft.rewardCapCents > 0
      : typeof draft.rewardAmountCents === 'number' && draft.rewardAmountCents > 0;

  const isValid =
    (draft.name ?? '').trim() !== '' &&
    rewardValid &&
    (draft.trigger !== 'SETTLEMENT' || draft.triggerOnWon || draft.triggerOnLost || draft.triggerOnVoid);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>

      <div>
        <span className="block text-xs text-text-secondary">Reward</span>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <select
            aria-label={`reward type ${campaign.id}`}
            value={draft.rewardType ?? 'FIXED'}
            onChange={(event) => setDraft({ ...draft, rewardType: event.target.value as backendApi.BetAndGetRewardType })}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="FIXED">Fixed amount</option>
            <option value="PERCENTAGE">% of stake, up to a cap</option>
          </select>

          {draft.rewardType !== 'PERCENTAGE' && (
            <label className="flex items-center gap-1.5 text-sm text-text-secondary">
              Amount (£)
              <input
                type="text"
                inputMode="decimal"
                aria-label={`fixed reward amount ${campaign.id}`}
                value={rewardAmountText}
                onChange={(event) => {
                  setRewardAmountText(event.target.value);
                  setDraft({ ...draft, rewardAmountCents: displayToCents(event.target.value) });
                }}
                className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          )}

          {draft.rewardType === 'PERCENTAGE' && (
            <>
              <label className="flex items-center gap-1.5 text-sm text-text-secondary">
                Percent
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`reward percent ${campaign.id}`}
                  value={rewardPercentText}
                  onChange={(event) => {
                    setRewardPercentText(event.target.value);
                    setDraft({ ...draft, rewardPercent: Number(event.target.value) });
                  }}
                  className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex items-center gap-1.5 text-sm text-text-secondary">
                Cap (£)
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`reward cap ${campaign.id}`}
                  value={rewardCapText}
                  onChange={(event) => {
                    setRewardCapText(event.target.value);
                    setDraft({ ...draft, rewardCapCents: displayToCents(event.target.value) });
                  }}
                  className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
            </>
          )}
        </div>
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
          setDraft({ ...draft, endAt: localInputValueToIso(value) });
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <span className="block text-xs text-text-secondary">Trigger</span>
          <div className="mt-1 flex gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name={`trigger-${campaign.id}`}
                checked={draft.trigger === 'PLACEMENT'}
                onChange={() => setDraft({ ...draft, trigger: 'PLACEMENT' })}
              />
              Placement
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name={`trigger-${campaign.id}`}
                checked={draft.trigger === 'SETTLEMENT'}
                onChange={() => setDraft({ ...draft, trigger: 'SETTLEMENT' })}
              />
              Settlement
            </label>
          </div>
        </div>

        {draft.trigger === 'SETTLEMENT' && (
          <div>
            <span className="block text-xs text-text-secondary">Grant reward when the bet settles as</span>
            <div className="mt-1 flex gap-3 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={draft.triggerOnWon ?? false}
                  onChange={(event) => setDraft({ ...draft, triggerOnWon: event.target.checked })}
                />
                Won
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={draft.triggerOnLost ?? false}
                  onChange={(event) => setDraft({ ...draft, triggerOnLost: event.target.checked })}
                />
                Lost
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={draft.triggerOnVoid ?? false}
                  onChange={(event) => setDraft({ ...draft, triggerOnVoid: event.target.checked })}
                />
                Void
              </label>
            </div>
          </div>
        )}
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
              setDraft({ ...draft, minStakeCents: event.target.value === '' ? null : displayToCents(event.target.value) });
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.allowMultipleRedemptions ?? false}
            onChange={(event) => setDraft({ ...draft, allowMultipleRedemptions: event.target.checked })}
          />
          Allow multiple redemptions per player
        </label>
        {draft.allowMultipleRedemptions && (
          <div>
            <label className="block text-xs text-text-secondary" htmlFor={`max-redemptions-${campaign.id}`}>
              Max redemptions per player
            </label>
            <input
              id={`max-redemptions-${campaign.id}`}
              type="text"
              inputMode="numeric"
              value={maxRedemptionsText}
              placeholder="Unlimited"
              onChange={(event) => {
                setMaxRedemptionsText(event.target.value);
                setDraft({ ...draft, maxRedemptionsPerPlayer: event.target.value === '' ? null : Number(event.target.value) });
              }}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      {!isValid && draft.trigger === 'SETTLEMENT' && (
        <p className="text-xs text-danger">Pick at least one settlement outcome (Won/Lost/Void) to trigger on.</p>
      )}

      <Button variant="secondary" disabled={!isValid || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        Save details
      </Button>
    </div>
  );
}

interface CampaignCardProps {
  campaign: backendApi.BetAndGetCampaign;
  matches: Match[] | undefined;
  matchesLoading: boolean;
  matchesError: boolean;
}

function CampaignCard({ campaign, matches, matchesLoading, matchesError }: CampaignCardProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const toggleEnabledMutation = useMutation({
    mutationFn: () => backendApi.updateBetAndGetCampaign(campaign.id, { enabled: !campaign.enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success(campaign.enabled ? 'Campaign disabled' : 'Campaign enabled');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update campaign')),
  });

  const setScopesMutation = useMutation({
    mutationFn: (scopes: { scopeType: backendApi.BetAndGetScopeType; scopeValue: string }[]) =>
      backendApi.setBetAndGetCampaignScopes(campaign.id, scopes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success('Scope saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save scope')),
  });

  const removeMutation = useMutation({
    mutationFn: () => backendApi.removeBetAndGetCampaign(campaign.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success('Campaign removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove campaign')),
  });

  const rewardSummary =
    campaign.rewardType === 'PERCENTAGE'
      ? `${campaign.rewardPercent ?? 0}% of stake, up to £${centsToDisplay(campaign.rewardCapCents ?? 0)}`
      : `£${centsToDisplay(campaign.rewardAmountCents ?? 0)} freebet`;

  return (
    <CampaignCardShell
      name={campaign.name}
      enabled={campaign.enabled}
      summary={`${rewardSummary} · ${campaign.trigger.toLowerCase()} · ${campaign.scopes.length} scope ${campaign.scopes.length === 1 ? 'entry' : 'entries'}`}
      scheduleLine={campaign.startAt || campaign.endAt ? formatScheduleWindow(campaign) : null}
      onToggleEnabled={() => toggleEnabledMutation.mutate()}
      isTogglingEnabled={toggleEnabledMutation.isPending}
      onDelete={() => removeMutation.mutate()}
      isDeleting={removeMutation.isPending}
      extraActions={
        <Button
          variant="secondary"
          onClick={() => navigate('/push-notifications', { state: { betAndGetCampaignId: campaign.id, campaignName: campaign.name } })}
        >
          Send push for this campaign
        </Button>
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
    </CampaignCardShell>
  );
}

export function BetAndGetCampaignsTab() {
  const { data: campaigns, isPending, isError } = useQuery({
    queryKey: campaignsQueryKey,
    queryFn: backendApi.listBetAndGetCampaigns,
  });

  const { data: matches, isPending: matchesLoading, isError: matchesError } = useQuery({
    queryKey: matchesQueryKey,
    queryFn: oddsEngineApi.fetchMatches,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Freebet rewards - a fixed amount or a percentage of the qualifying bet's own stake, capped - for bets on
        a chosen sport, competition, or match. A bet only qualifies when every one of its selections falls
        within the campaign's scope and meets its conditions.
      </p>

      <NewCampaignForm />

      {isPending && (
        <div className="space-y-2" aria-label="Loading campaigns" role="status">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      {isError && <p className="text-sm text-danger">Failed to load Bet & Get campaigns.</p>}
      {!isPending && campaigns?.length === 0 && <p className="text-sm text-text-secondary">No campaigns yet - create one above.</p>}

      <div className="space-y-2">
        {campaigns?.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} matches={matches} matchesLoading={matchesLoading} matchesError={matchesError} />
        ))}
      </div>
    </div>
  );
}

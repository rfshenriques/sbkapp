import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { toast, errorMessage } from '../toast/toastStore';
import * as backendApi from '../../lib/backendApi';
import type { AudienceMode } from '../../lib/backendApi';
import { formatScheduleWindow, isoToLocalInputValue, localInputValueToIso } from '../../lib/dateTimeInput';
import { CampaignAudienceEditor } from './CampaignAudienceEditor';
import { CampaignCardShell } from './CampaignCardShell';
import { CampaignScheduleFields } from './CampaignScheduleFields';
import { centsToDisplay, displayToCents } from './campaignFormatters';

const campaignsQueryKey = ['register-campaigns'] as const;

const DEFAULT_REWARD_AMOUNT = '10.00';
const DEFAULT_REWARD_PERCENT = '10';
const DEFAULT_REWARD_CAP = '50.00';
const DEFAULT_WINDOW_DAYS = '7';

function NewCampaignForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [rewardType, setRewardType] = useState<backendApi.BetAndGetRewardType>('FIXED');
  const [rewardAmount, setRewardAmount] = useState(DEFAULT_REWARD_AMOUNT);
  const [rewardPercent, setRewardPercent] = useState(DEFAULT_REWARD_PERCENT);
  const [rewardCap, setRewardCap] = useState(DEFAULT_REWARD_CAP);
  const [requiresBet, setRequiresBet] = useState(false);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      backendApi.createRegisterCampaign({
        name: name.trim(),
        rewardType,
        startAt: localInputValueToIso(startAt),
        endAt: localInputValueToIso(endAt),
        requiresBet,
        ...(requiresBet ? { qualifyingBetWindowDays: Number(windowDays) } : {}),
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
      setRequiresBet(false);
      setWindowDays(DEFAULT_WINDOW_DAYS);
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
  const windowValid = !requiresBet || (Number.isFinite(Number(windowDays)) && Number(windowDays) > 0);
  const percentAllowed = !requiresBet ? rewardType === 'FIXED' : true;

  const isValid = name.trim() !== '' && rewardValid && windowValid && percentAllowed;

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">New Register campaign</h2>
      <p className="text-xs text-text-secondary">
        A welcome bonus for new players - granted immediately on signup, or deferred until they place a qualifying
        bet within a chosen number of days. Created disabled - enable it below once it's ready to go live.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Campaign name (e.g. Welcome Bonus)"
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
          <option value="PERCENTAGE" disabled={!requiresBet}>
            % of first qualifying bet
          </option>
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
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requiresBet}
            onChange={(event) => {
              setRequiresBet(event.target.checked);
              if (!event.target.checked) setRewardType('FIXED');
            }}
          />
          Requires a qualifying bet before the reward is granted
        </label>
        {requiresBet && (
          <label className="flex items-center gap-1.5 text-sm text-text-secondary">
            within
            <input
              type="text"
              inputMode="numeric"
              value={windowDays}
              onChange={(event) => setWindowDays(event.target.value)}
              aria-label="Qualifying bet window days"
              className="w-14 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            days of signup
          </label>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <CampaignScheduleFields
          idPrefix="new-register-campaign"
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
  campaign: backendApi.RegisterCampaign;
}

function CampaignDetailsForm({ campaign }: CampaignDetailsFormProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<backendApi.UpdateRegisterCampaignPayload>({
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
  const [windowDaysText, setWindowDaysText] = useState(campaign.qualifyingBetWindowDays?.toString() ?? '');
  const [minStakeText, setMinStakeText] = useState(campaign.minStakeCents != null ? centsToDisplay(campaign.minStakeCents) : '');
  const [minOddsText, setMinOddsText] = useState(campaign.minOddsPerLeg?.toString() ?? '');
  const [minSelectionsText, setMinSelectionsText] = useState(campaign.minSelections?.toString() ?? '');
  const [startAtText, setStartAtText] = useState(isoToLocalInputValue(campaign.startAt));
  const [endAtText, setEndAtText] = useState(isoToLocalInputValue(campaign.endAt));

  useEffect(() => {
    setDraft({ ...campaign, segmentIds: campaign.segments.map((segment) => segment.segmentId) });
    setRewardAmountText(campaign.rewardAmountCents != null ? centsToDisplay(campaign.rewardAmountCents) : '');
    setRewardPercentText(campaign.rewardPercent?.toString() ?? '');
    setRewardCapText(campaign.rewardCapCents != null ? centsToDisplay(campaign.rewardCapCents) : '');
    setWindowDaysText(campaign.qualifyingBetWindowDays?.toString() ?? '');
    setMinStakeText(campaign.minStakeCents != null ? centsToDisplay(campaign.minStakeCents) : '');
    setMinOddsText(campaign.minOddsPerLeg?.toString() ?? '');
    setMinSelectionsText(campaign.minSelections?.toString() ?? '');
    setStartAtText(isoToLocalInputValue(campaign.startAt));
    setEndAtText(isoToLocalInputValue(campaign.endAt));
  }, [campaign]);

  const saveMutation = useMutation({
    mutationFn: () => backendApi.updateRegisterCampaign(campaign.id, draft),
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
    (!draft.requiresBet || (typeof draft.qualifyingBetWindowDays === 'number' && draft.qualifyingBetWindowDays > 0)) &&
    (draft.trigger !== 'SETTLEMENT' || !draft.requiresBet || draft.triggerOnWon || draft.triggerOnLost || draft.triggerOnVoid);

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
          setDraft({ ...draft, endAt: localInputValueToIso(value) });
        }}
      />

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
            <option value="PERCENTAGE" disabled={!draft.requiresBet}>
              % of first qualifying bet, up to a cap
            </option>
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

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.requiresBet ?? false}
            onChange={(event) => {
              const checked = event.target.checked;
              setDraft({ ...draft, requiresBet: checked, ...(checked ? {} : { rewardType: 'FIXED' }) });
            }}
          />
          Requires a qualifying bet before the reward is granted
        </label>
        {draft.requiresBet && (
          <label className="flex items-center gap-1.5 text-sm text-text-secondary">
            within
            <input
              type="text"
              inputMode="numeric"
              value={windowDaysText}
              onChange={(event) => {
                setWindowDaysText(event.target.value);
                setDraft({
                  ...draft,
                  qualifyingBetWindowDays: event.target.value === '' ? null : Number(event.target.value),
                });
              }}
              aria-label={`qualifying bet window days ${campaign.id}`}
              className="w-14 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            days of signup
          </label>
        )}
      </div>

      {draft.requiresBet && (
        <>
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          </div>
        </>
      )}

      <CampaignAudienceEditor
        idPrefix={campaign.id}
        audienceMode={draft.audienceMode ?? 'ALL'}
        segmentIds={draft.segmentIds ?? []}
        onAudienceModeChange={(mode) => setDraft({ ...draft, audienceMode: mode as AudienceMode })}
        onToggleSegment={toggleSegment}
      />
      <p className="text-xs text-text-muted">
        A SEGMENTS-mode campaign never matches a fresh signup - they aren't in any segment yet. Use LOGGED_OUT/ALL
        for register campaigns, or target returning signups via a bet-requirement campaign instead.
      </p>

      {!isValid && draft.requiresBet && draft.trigger === 'SETTLEMENT' && (
        <p className="text-xs text-danger">Pick at least one settlement outcome (Won/Lost/Void) to trigger on.</p>
      )}

      <Button variant="secondary" disabled={!isValid || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        Save details
      </Button>
    </div>
  );
}

interface CampaignCardProps {
  campaign: backendApi.RegisterCampaign;
}

function CampaignCard({ campaign }: CampaignCardProps) {
  const queryClient = useQueryClient();

  const toggleEnabledMutation = useMutation({
    mutationFn: () => backendApi.updateRegisterCampaign(campaign.id, { enabled: !campaign.enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success(campaign.enabled ? 'Campaign disabled' : 'Campaign enabled');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update campaign')),
  });

  const removeMutation = useMutation({
    mutationFn: () => backendApi.removeRegisterCampaign(campaign.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
      toast.success('Campaign removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove campaign')),
  });

  const rewardSummary =
    campaign.rewardType === 'PERCENTAGE'
      ? `${campaign.rewardPercent ?? 0}% of first bet, up to £${centsToDisplay(campaign.rewardCapCents ?? 0)}`
      : `£${centsToDisplay(campaign.rewardAmountCents ?? 0)} freebet`;

  return (
    <CampaignCardShell
      name={campaign.name}
      enabled={campaign.enabled}
      summary={`${rewardSummary} · ${campaign.requiresBet ? `requires bet within ${campaign.qualifyingBetWindowDays ?? '?'}d` : 'granted on signup'}`}
      scheduleLine={campaign.startAt || campaign.endAt ? formatScheduleWindow(campaign) : null}
      onToggleEnabled={() => toggleEnabledMutation.mutate()}
      isTogglingEnabled={toggleEnabledMutation.isPending}
      onDelete={() => removeMutation.mutate()}
      isDeleting={removeMutation.isPending}
    >
      <CampaignDetailsForm campaign={campaign} />
    </CampaignCardShell>
  );
}

export function RegisterCampaignsTab() {
  const { data: campaigns, isPending, isError } = useQuery({
    queryKey: campaignsQueryKey,
    queryFn: backendApi.listRegisterCampaigns,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Welcome bonuses for new players only - available at most once per player, ever. Either granted the instant
        registration completes, or deferred until a qualifying bet is placed within a chosen day window of signup.
      </p>

      <NewCampaignForm />

      {isPending && (
        <div className="space-y-2" aria-label="Loading campaigns" role="status">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      {isError && <p className="text-sm text-danger">Failed to load Register campaigns.</p>}
      {!isPending && campaigns?.length === 0 && <p className="text-sm text-text-secondary">No campaigns yet - create one above.</p>}

      <div className="space-y-2">
        {campaigns?.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </div>
  );
}

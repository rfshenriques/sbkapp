import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import * as backendApi from '../lib/backendApi';
import type { AudienceMode } from '../lib/backendApi';
import { formatScheduleWindow, isoToLocalInputValue, localInputValueToIso } from '../lib/dateTimeInput';

const campaignsQueryKey = ['deposit-campaigns'] as const;
const segmentsQueryKey = ['player-segments'] as const;

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function displayToCents(value: string): number {
  return Math.round(Number(value) * 100);
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

const DEFAULT_MIN_DEPOSIT = '10.00';
const DEFAULT_FIXED_REWARD = '5.00';
const DEFAULT_REWARD_PERCENT = '10';
const DEFAULT_REWARD_CAP = '50.00';

function NewCampaignForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [minDepositAmount, setMinDepositAmount] = useState(DEFAULT_MIN_DEPOSIT);
  const [rewardType, setRewardType] = useState<backendApi.DepositRewardType>('FIXED');
  const [fixedRewardAmount, setFixedRewardAmount] = useState(DEFAULT_FIXED_REWARD);
  const [rewardPercent, setRewardPercent] = useState(DEFAULT_REWARD_PERCENT);
  const [rewardCap, setRewardCap] = useState(DEFAULT_REWARD_CAP);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      backendApi.createDepositCampaign({
        name: name.trim(),
        minDepositAmountCents: displayToCents(minDepositAmount),
        rewardType,
        startAt: localInputValueToIso(startAt),
        endAt: localInputValueToIso(endAt),
        ...(rewardType === 'FIXED'
          ? { fixedRewardAmountCents: displayToCents(fixedRewardAmount) }
          : { rewardPercent: Number(rewardPercent), rewardCapCents: displayToCents(rewardCap) }),
      }),
    onSuccess: () => {
      setName('');
      setMinDepositAmount(DEFAULT_MIN_DEPOSIT);
      setRewardType('FIXED');
      setFixedRewardAmount(DEFAULT_FIXED_REWARD);
      setRewardPercent(DEFAULT_REWARD_PERCENT);
      setRewardCap(DEFAULT_REWARD_CAP);
      setStartAt('');
      setEndAt('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const rewardValid =
    rewardType === 'FIXED'
      ? Number.isFinite(displayToCents(fixedRewardAmount)) && displayToCents(fixedRewardAmount) > 0
      : Number(rewardPercent) > 0 && Number.isFinite(displayToCents(rewardCap)) && displayToCents(rewardCap) > 0;

  const isValid =
    name.trim() !== '' &&
    Number.isFinite(displayToCents(minDepositAmount)) &&
    displayToCents(minDepositAmount) > 0 &&
    rewardValid;

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">New campaign</h2>
      <p className="text-xs text-text-secondary">
        Created disabled - configure the bet requirement and audience below, then enable it when it's ready to go
        live.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Campaign name (e.g. First Deposit Bonus)"
          aria-label="Campaign name"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-text-secondary">
          Min deposit
          <span className="flex items-center gap-1">
            <span>£</span>
            <input
              type="text"
              inputMode="decimal"
              value={minDepositAmount}
              onChange={(event) => setMinDepositAmount(event.target.value)}
              aria-label="Minimum deposit amount"
              className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </span>
        </label>
        <select
          aria-label="Reward type"
          value={rewardType}
          onChange={(event) => setRewardType(event.target.value as backendApi.DepositRewardType)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="FIXED">Fixed amount</option>
          <option value="PERCENTAGE">% of deposit</option>
        </select>
        {rewardType === 'FIXED' ? (
          <label className="flex items-center gap-1.5 text-sm text-text-secondary">
            Reward
            <span className="flex items-center gap-1">
              <span>£</span>
              <input
                type="text"
                inputMode="decimal"
                value={fixedRewardAmount}
                onChange={(event) => setFixedRewardAmount(event.target.value)}
                aria-label="Reward amount"
                className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </span>
          </label>
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
        <div>
          <label className="block text-xs text-text-secondary" htmlFor="new-deposit-campaign-start">
            Starts (optional)
          </label>
          <input
            id="new-deposit-campaign-start"
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary" htmlFor="new-deposit-campaign-end">
            Ends (optional)
          </label>
          <input
            id="new-deposit-campaign-end"
            type="datetime-local"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <p className="text-xs text-text-secondary">
          Leave either blank to run with no boundary on that side - enabling still requires the checkbox below.
        </p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}

interface CampaignDetailsFormProps {
  campaign: backendApi.DepositCampaign;
}

function CampaignDetailsForm({ campaign }: CampaignDetailsFormProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<backendApi.UpdateDepositCampaignPayload>({
    ...campaign,
    segmentIds: campaign.segments.map((segment) => segment.segmentId),
  });

  // Free-typed number/currency fields keep their own string draft, synced
  // from the campaign only (never re-derived from `draft` on every
  // keystroke) - deriving display text straight from the numeric value
  // would silently strip a trailing "." or "0" as the user types it,
  // making decimals like 1.50 impossible to enter.
  const [minDepositText, setMinDepositText] = useState(centsToDisplay(campaign.minDepositAmountCents));
  const [fixedRewardText, setFixedRewardText] = useState(
    campaign.fixedRewardAmountCents != null ? centsToDisplay(campaign.fixedRewardAmountCents) : '',
  );
  const [rewardPercentText, setRewardPercentText] = useState(campaign.rewardPercent?.toString() ?? '');
  const [rewardCapText, setRewardCapText] = useState(
    campaign.rewardCapCents != null ? centsToDisplay(campaign.rewardCapCents) : '',
  );
  const [minStakeText, setMinStakeText] = useState(campaign.minStakeCents != null ? centsToDisplay(campaign.minStakeCents) : '');
  const [minOddsText, setMinOddsText] = useState(campaign.minOddsPerLeg?.toString() ?? '');
  const [minSelectionsText, setMinSelectionsText] = useState(campaign.minSelections?.toString() ?? '');
  const [maxRedemptionsText, setMaxRedemptionsText] = useState(campaign.maxRedemptionsPerPlayer?.toString() ?? '');
  const [startAtText, setStartAtText] = useState(isoToLocalInputValue(campaign.startAt));
  const [endAtText, setEndAtText] = useState(isoToLocalInputValue(campaign.endAt));

  useEffect(() => {
    setDraft({ ...campaign, segmentIds: campaign.segments.map((segment) => segment.segmentId) });
    setMinDepositText(centsToDisplay(campaign.minDepositAmountCents));
    setFixedRewardText(campaign.fixedRewardAmountCents != null ? centsToDisplay(campaign.fixedRewardAmountCents) : '');
    setRewardPercentText(campaign.rewardPercent?.toString() ?? '');
    setRewardCapText(campaign.rewardCapCents != null ? centsToDisplay(campaign.rewardCapCents) : '');
    setMinStakeText(campaign.minStakeCents != null ? centsToDisplay(campaign.minStakeCents) : '');
    setMinOddsText(campaign.minOddsPerLeg?.toString() ?? '');
    setMinSelectionsText(campaign.minSelections?.toString() ?? '');
    setMaxRedemptionsText(campaign.maxRedemptionsPerPlayer?.toString() ?? '');
    setStartAtText(isoToLocalInputValue(campaign.startAt));
    setEndAtText(isoToLocalInputValue(campaign.endAt));
  }, [campaign]);

  const { data: segments } = useQuery({
    queryKey: segmentsQueryKey,
    queryFn: backendApi.listPlayerSegments,
    enabled: draft.audienceMode === 'SEGMENTS',
  });

  const saveMutation = useMutation({
    mutationFn: () => backendApi.updateDepositCampaign(campaign.id, draft),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  });

  function toggleSegment(segmentId: string) {
    setDraft((previous) => {
      const current = previous.segmentIds ?? [];
      return {
        ...previous,
        segmentIds: current.includes(segmentId)
          ? current.filter((id) => id !== segmentId)
          : [...current, segmentId],
      };
    });
  }

  const rewardValid =
    draft.rewardType === 'FIXED'
      ? typeof draft.fixedRewardAmountCents === 'number' && draft.fixedRewardAmountCents > 0
      : typeof draft.rewardPercent === 'number' &&
        draft.rewardPercent > 0 &&
        typeof draft.rewardCapCents === 'number' &&
        draft.rewardCapCents > 0;

  const isValid =
    (draft.name ?? '').trim() !== '' &&
    typeof draft.minDepositAmountCents === 'number' &&
    draft.minDepositAmountCents > 0 &&
    rewardValid &&
    (!draft.requiresBet ||
      draft.trigger !== 'SETTLEMENT' ||
      draft.triggerOnWon ||
      draft.triggerOnLost ||
      draft.triggerOnVoid);

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
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`min-deposit-${campaign.id}`}>
            Minimum deposit (£)
          </label>
          <input
            id={`min-deposit-${campaign.id}`}
            type="text"
            inputMode="decimal"
            value={minDepositText}
            onChange={(event) => {
              setMinDepositText(event.target.value);
              setDraft({ ...draft, minDepositAmountCents: displayToCents(event.target.value) });
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`start-${campaign.id}`}>
            Starts (optional)
          </label>
          <input
            id={`start-${campaign.id}`}
            type="datetime-local"
            value={startAtText}
            onChange={(event) => {
              setStartAtText(event.target.value);
              setDraft({ ...draft, startAt: localInputValueToIso(event.target.value) });
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`end-${campaign.id}`}>
            Ends (optional)
          </label>
          <input
            id={`end-${campaign.id}`}
            type="datetime-local"
            value={endAtText}
            onChange={(event) => {
              setEndAtText(event.target.value);
              setDraft({ ...draft, endAt: localInputValueToIso(event.target.value) });
            }}
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
            onChange={(event) =>
              setDraft({ ...draft, rewardType: event.target.value as backendApi.DepositRewardType })
            }
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="FIXED">Fixed amount</option>
            <option value="PERCENTAGE">% of deposit, up to a cap</option>
          </select>

          {draft.rewardType === 'FIXED' && (
            <label className="flex items-center gap-1.5 text-sm text-text-secondary">
              Amount (£)
              <input
                type="text"
                inputMode="decimal"
                aria-label={`fixed reward amount ${campaign.id}`}
                value={fixedRewardText}
                onChange={(event) => {
                  setFixedRewardText(event.target.value);
                  setDraft({ ...draft, fixedRewardAmountCents: displayToCents(event.target.value) });
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

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.requiresBet ?? false}
          onChange={(event) => setDraft({ ...draft, requiresBet: event.target.checked })}
        />
        Requires a qualifying bet after the deposit before the reward is granted
      </label>

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
                  setDraft({
                    ...draft,
                    minStakeCents: event.target.value === '' ? null : displayToCents(event.target.value),
                  });
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-1.5 text-sm text-text-secondary">
          Audience
          <select
            aria-label={`audience ${campaign.id}`}
            value={draft.audienceMode ?? 'ALL'}
            onChange={(event) => setDraft({ ...draft, audienceMode: event.target.value as AudienceMode })}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            {AUDIENCE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {audienceLabel(mode)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {draft.audienceMode === 'SEGMENTS' && (
        <div className="flex flex-wrap gap-2">
          {(segments ?? []).length === 0 && (
            <span className="text-xs text-text-muted">No player segments exist yet.</span>
          )}
          {segments?.map((segment) => (
            <label key={segment.id} className="flex items-center gap-1 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={(draft.segmentIds ?? []).includes(segment.id)}
                onChange={() => toggleSegment(segment.id)}
              />
              {segment.name}
            </label>
          ))}
        </div>
      )}

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
                setDraft({
                  ...draft,
                  maxRedemptionsPerPlayer: event.target.value === '' ? null : Number(event.target.value),
                });
              }}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      {!isValid && (
        <p className="text-xs text-danger">
          {!rewardValid
            ? draft.rewardType === 'FIXED'
              ? 'Enter a fixed reward amount.'
              : 'Enter a reward percent and a cap amount.'
            : 'Pick at least one settlement outcome (Won/Lost/Void) to trigger on.'}
        </p>
      )}

      <Button variant="secondary" disabled={!isValid || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        Save details
      </Button>
    </div>
  );
}

interface CampaignCardProps {
  campaign: backendApi.DepositCampaign;
}

function CampaignCard({ campaign }: CampaignCardProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleEnabledMutation = useMutation({
    mutationFn: () => backendApi.updateDepositCampaign(campaign.id, { enabled: !campaign.enabled }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: () => backendApi.removeDepositCampaign(campaign.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  });

  const rewardSummary =
    campaign.rewardType === 'FIXED'
      ? `£${centsToDisplay(campaign.fixedRewardAmountCents ?? 0)} freebet`
      : `${campaign.rewardPercent ?? 0}% up to £${centsToDisplay(campaign.rewardCapCents ?? 0)}`;

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
              campaign.enabled ? 'bg-highlight/20 text-highlight' : 'bg-background text-text-muted'
            }`}
          >
            {campaign.enabled ? 'Live' : 'Draft'}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{campaign.name}</span>
            <span className="block text-xs text-text-secondary">
              {rewardSummary} · min deposit £{centsToDisplay(campaign.minDepositAmountCents)} ·{' '}
              {campaign.requiresBet ? `requires bet (${campaign.trigger.toLowerCase()})` : 'no bet required'}
            </span>
            {(campaign.startAt || campaign.endAt) && (
              <span className="block text-xs text-text-secondary">{formatScheduleWindow(campaign)}</span>
            )}
          </span>
        </span>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t border-border p-4 pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={campaign.enabled}
              disabled={toggleEnabledMutation.isPending}
              onChange={() => toggleEnabledMutation.mutate()}
            />
            Enabled (visible to players and eligible to grant rewards)
          </label>

          <CampaignDetailsForm campaign={campaign} />

          <div className="border-t border-border pt-3">
            <Button variant="ghost" onClick={() => removeMutation.mutate()} disabled={removeMutation.isPending}>
              Delete campaign
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function DepositCampaignsPage() {
  const {
    data: campaigns,
    isPending,
    isError,
  } = useQuery({ queryKey: campaignsQueryKey, queryFn: backendApi.listDepositCampaigns });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Deposit campaigns</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Freebet rewards for players who deposit, shown as a modal right after login when a player is targeted by an
        eligible campaign. A player who doesn't deposit through the popup can still redeem via a promo card on the
        homepage or Promotions page.
      </p>

      <div className="mt-4 space-y-4">
        <NewCampaignForm />

        {isPending && <p className="text-sm text-text-secondary">Loading campaigns…</p>}
        {isError && <p className="text-sm text-danger">Failed to load deposit campaigns.</p>}
        {!isPending && campaigns?.length === 0 && (
          <p className="text-sm text-text-secondary">No campaigns yet - create one above.</p>
        )}

        <div className="space-y-2">
          {campaigns?.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      </div>
    </div>
  );
}

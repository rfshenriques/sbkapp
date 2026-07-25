import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Match } from '@sportsbook/shared';
import { MatchDrilldown } from '../components/MatchDrilldown';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import * as backendApi from '../lib/backendApi';
import { formatScheduleWindow, isoToLocalInputValue, localInputValueToIso } from '../lib/dateTimeInput';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const campaignsQueryKey = ['bet-and-get-campaigns'] as const;
const matchesQueryKey = ['live-matches'] as const;

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function displayToCents(value: string): number {
  return Math.round(Number(value) * 100);
}

function NewCampaignForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [rewardAmount, setRewardAmount] = useState('10.00');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      backendApi.createBetAndGetCampaign({
        name: name.trim(),
        rewardAmountCents: displayToCents(rewardAmount),
        startAt: localInputValueToIso(startAt),
        endAt: localInputValueToIso(endAt),
      }),
    onSuccess: () => {
      setName('');
      setRewardAmount('10.00');
      setStartAt('');
      setEndAt('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const isValid = name.trim() !== '' && Number.isFinite(displayToCents(rewardAmount)) && displayToCents(rewardAmount) > 0;

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">New campaign</h2>
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
        <Button variant="primary" disabled={!isValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
          Create
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div>
          <label className="block text-xs text-text-secondary" htmlFor="new-campaign-start">
            Starts (optional)
          </label>
          <input
            id="new-campaign-start"
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary" htmlFor="new-campaign-end">
            Ends (optional)
          </label>
          <input
            id="new-campaign-end"
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
  campaign: backendApi.BetAndGetCampaign;
}

function CampaignDetailsForm({ campaign }: CampaignDetailsFormProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<backendApi.UpdateBetAndGetCampaignPayload>(campaign);

  // Free-typed number/currency fields keep their own string draft, synced
  // from the campaign only (never re-derived from `draft` on every
  // keystroke) - deriving display text straight from the numeric value
  // would silently strip a trailing "." or "0" as the user types it,
  // making decimals like 1.50 impossible to enter.
  const [rewardAmountText, setRewardAmountText] = useState(centsToDisplay(campaign.rewardAmountCents));
  const [minStakeText, setMinStakeText] = useState(campaign.minStakeCents != null ? centsToDisplay(campaign.minStakeCents) : '');
  const [minOddsText, setMinOddsText] = useState(campaign.minOddsPerLeg?.toString() ?? '');
  const [minSelectionsText, setMinSelectionsText] = useState(campaign.minSelections?.toString() ?? '');
  const [maxRedemptionsText, setMaxRedemptionsText] = useState(campaign.maxRedemptionsPerPlayer?.toString() ?? '');
  const [startAtText, setStartAtText] = useState(isoToLocalInputValue(campaign.startAt));
  const [endAtText, setEndAtText] = useState(isoToLocalInputValue(campaign.endAt));

  useEffect(() => {
    setDraft(campaign);
    setRewardAmountText(centsToDisplay(campaign.rewardAmountCents));
    setMinStakeText(campaign.minStakeCents != null ? centsToDisplay(campaign.minStakeCents) : '');
    setMinOddsText(campaign.minOddsPerLeg?.toString() ?? '');
    setMinSelectionsText(campaign.minSelections?.toString() ?? '');
    setMaxRedemptionsText(campaign.maxRedemptionsPerPlayer?.toString() ?? '');
    setStartAtText(isoToLocalInputValue(campaign.startAt));
    setEndAtText(isoToLocalInputValue(campaign.endAt));
  }, [campaign]);

  const saveMutation = useMutation({
    mutationFn: () => backendApi.updateBetAndGetCampaign(campaign.id, draft),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  });

  const isValid =
    (draft.name ?? '').trim() !== '' &&
    typeof draft.rewardAmountCents === 'number' &&
    draft.rewardAmountCents > 0 &&
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
        <div>
          <label className="block text-xs text-text-secondary" htmlFor={`reward-${campaign.id}`}>
            Reward amount (£)
          </label>
          <input
            id={`reward-${campaign.id}`}
            type="text"
            inputMode="decimal"
            value={rewardAmountText}
            onChange={(event) => {
              setRewardAmountText(event.target.value);
              setDraft({ ...draft, rewardAmountCents: displayToCents(event.target.value) });
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

      {!isValid && draft.trigger === 'SETTLEMENT' && (
        <p className="text-xs text-danger">Pick at least one settlement outcome (Won/Lost/Void) to trigger on.</p>
      )}

      <Button variant="secondary" disabled={!isValid || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        Save details
      </Button>
    </div>
  );
}

interface CampaignScopeEditorProps {
  campaign: backendApi.BetAndGetCampaign;
  matches: Match[] | undefined;
  matchesLoading: boolean;
  matchesError: boolean;
}

function CampaignScopeEditor({ campaign, matches, matchesLoading, matchesError }: CampaignScopeEditorProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(campaign.scopes.map(({ scopeType, scopeValue }) => ({ scopeType, scopeValue })));
  const [isPicking, setIsPicking] = useState(false);

  useEffect(
    () => setDraft(campaign.scopes.map(({ scopeType, scopeValue }) => ({ scopeType, scopeValue }))),
    [campaign.scopes],
  );

  const saveMutation = useMutation({
    mutationFn: () => backendApi.setBetAndGetCampaignScopes(campaign.id, draft),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  });

  function has(scopeType: backendApi.BetAndGetScopeType, scopeValue: string): boolean {
    return draft.some((entry) => entry.scopeType === scopeType && entry.scopeValue === scopeValue);
  }
  function add(scopeType: backendApi.BetAndGetScopeType, scopeValue: string) {
    if (has(scopeType, scopeValue)) return;
    setDraft((previous) => [...previous, { scopeType, scopeValue }]);
  }
  function remove(scopeType: backendApi.BetAndGetScopeType, scopeValue: string) {
    setDraft((previous) => previous.filter((entry) => !(entry.scopeType === scopeType && entry.scopeValue === scopeValue)));
  }

  const isDirty =
    draft.length !== campaign.scopes.length ||
    draft.some((entry) => !campaign.scopes.some((s) => s.scopeType === entry.scopeType && s.scopeValue === entry.scopeValue));

  return (
    <div className="space-y-3">
      <div>
        <span className="block text-xs text-text-secondary">
          Sports, competitions, and matches this campaign applies to (a bet only qualifies when every one of its
          selections falls within this scope)
        </span>
        {draft.length === 0 && <p className="mt-1 text-sm text-text-secondary">No scope set yet - this campaign matches nothing.</p>}
        {draft.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {draft.map((entry) => (
              <span
                key={`${entry.scopeType}:${entry.scopeValue}`}
                className="flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs"
              >
                <span className="text-text-muted">{entry.scopeType}</span> {entry.scopeValue}
                <button
                  type="button"
                  aria-label={`Remove ${entry.scopeValue} from scope`}
                  onClick={() => remove(entry.scopeType, entry.scopeValue)}
                  className="ml-1 text-text-muted hover:text-danger"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Button variant="ghost" onClick={() => setIsPicking((value) => !value)}>
        {isPicking ? 'Hide match picker' : 'Add from live matches'}
      </Button>

      {isPicking && (
        <MatchDrilldown
          matches={matches}
          isLoading={matchesLoading}
          isError={matchesError}
          renderLeague={(node) => {
            const sport = node.matches[0]?.sport;
            return (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {sport && (
                    <Button
                      variant="secondary"
                      disabled={has('SPORT', sport)}
                      onClick={() => add('SPORT', sport)}
                    >
                      {has('SPORT', sport) ? `Sport "${sport}" added` : `Add whole sport: ${sport}`}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={has('COMPETITION', node.competition)}
                    onClick={() => add('COMPETITION', node.competition)}
                  >
                    {has('COMPETITION', node.competition)
                      ? `Competition "${node.competition}" added`
                      : `Add whole competition: ${node.competition}`}
                  </Button>
                </div>
                <div className="space-y-1">
                  {node.matches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {match.homeTeam} vs {match.awayTeam}
                      </span>
                      <Button variant="ghost" disabled={has('MATCH', match.id)} onClick={() => add('MATCH', match.id)}>
                        {has('MATCH', match.id) ? 'Added' : 'Add match'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
        />
      )}

      <Button variant="secondary" disabled={!isDirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        Save scope
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
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleEnabledMutation = useMutation({
    mutationFn: () => backendApi.updateBetAndGetCampaign(campaign.id, { enabled: !campaign.enabled }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: () => backendApi.removeBetAndGetCampaign(campaign.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  });

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
              £{centsToDisplay(campaign.rewardAmountCents)} freebet · {campaign.trigger.toLowerCase()} ·{' '}
              {campaign.scopes.length} scope {campaign.scopes.length === 1 ? 'entry' : 'entries'}
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
            <CampaignScopeEditor
              campaign={campaign}
              matches={matches}
              matchesLoading={matchesLoading}
              matchesError={matchesError}
            />
          </div>

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

export default function BetAndGetCampaignsPage() {
  const {
    data: campaigns,
    isPending,
    isError,
  } = useQuery({ queryKey: campaignsQueryKey, queryFn: backendApi.listBetAndGetCampaigns });

  const {
    data: matches,
    isPending: matchesLoading,
    isError: matchesError,
  } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Bet & Get campaigns</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Fixed-amount freebet rewards for bets on a chosen sport, competition, or match. A bet only qualifies
        when every one of its selections falls within the campaign's scope and meets its conditions.
        Percentage and accumulated Bet & Get variants are a later build, not this one.
      </p>

      <div className="mt-4 space-y-4">
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
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              matches={matches}
              matchesLoading={matchesLoading}
              matchesError={matchesError}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

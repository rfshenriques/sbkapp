import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import { Skeleton } from '../components/ui/Skeleton';
import { toast, errorMessage } from '../features/toast/toastStore';
import * as backendApi from '../lib/backendApi';
import type { AudienceMode } from '../lib/backendApi';

const pushNotificationsQueryKey = ['push-notifications'] as const;

/**
 * Passed via navigate(..., { state }) from a campaign's "Send push for
 * this campaign" button (see BetAndGetCampaignsTab/DepositCampaignsTab) -
 * pre-fills and locks the audience to that campaign's own targeting rather
 * than making staff re-find and re-select a campaign they already have
 * open in front of them.
 */
interface CampaignPrefillState {
  betAndGetCampaignId?: string;
  depositCampaignId?: string;
  campaignName?: string;
}

/** LOGGED_OUT is deliberately not offered - a push subscription can't exist without a logged-in userId, so it would always resolve to zero recipients (see PlayerSegmentService.resolveUserIdsForAudience). */
const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'SEGMENTS'];

function audienceLabel(mode: AudienceMode): string {
  return mode === 'ALL' ? 'Everyone' : 'Specific player segments';
}

function kindLabel(kind: backendApi.PushNotificationKind): string {
  switch (kind) {
    case 'CUSTOM':
      return 'Custom';
    case 'BET_WON':
      return 'Bet won (automatic)';
    case 'BET_AND_GET_CAMPAIGN':
      return 'Bet & Get campaign';
    case 'DEPOSIT_CAMPAIGN':
      return 'Deposit campaign';
  }
}

function ComposePushForm({ prefill }: { prefill: CampaignPrefillState | undefined }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('ALL');
  const [segmentIds, setSegmentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isCampaignLinked = Boolean(prefill?.betAndGetCampaignId || prefill?.depositCampaignId);

  const { data: segments } = useQuery({
    queryKey: ['player-segments'],
    queryFn: backendApi.listPlayerSegments,
    enabled: audienceMode === 'SEGMENTS' && !isCampaignLinked,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      backendApi.sendPushNotification({
        title: title.trim(),
        body: body.trim(),
        targetUrl: targetUrl.trim() || undefined,
        betAndGetCampaignId: prefill?.betAndGetCampaignId,
        depositCampaignId: prefill?.depositCampaignId,
        ...(isCampaignLinked ? {} : { audienceMode, segmentIds: audienceMode === 'SEGMENTS' ? segmentIds : [] }),
      }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setTargetUrl('');
      setAudienceMode('ALL');
      setSegmentIds([]);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: pushNotificationsQueryKey });
      toast.success('Push notification sent');
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      toast.error(errorMessage(mutationError, 'Failed to send push notification'));
    },
  });

  function toggleSegment(segmentId: string) {
    setSegmentIds((prev) => (prev.includes(segmentId) ? prev.filter((id) => id !== segmentId) : [...prev, segmentId]));
  }

  const isValid = title.trim() !== '' && body.trim() !== '';

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">Compose push notification</h2>
      {isCampaignLinked && (
        <p className="rounded-md bg-background px-3 py-2 text-xs text-text-secondary">
          Linked to <span className="font-semibold text-text-primary">{prefill?.campaignName}</span> - audience is
          this campaign's own targeting, not picked here.
        </p>
      )}

      <div className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          aria-label="Push notification title"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Body"
          aria-label="Push notification body"
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          placeholder="Target URL (optional, e.g. /my-bets)"
          aria-label="Push notification target URL"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {!isCampaignLinked && (
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm text-text-secondary">
            Audience
            <select
              aria-label="Audience"
              value={audienceMode}
              onChange={(event) => setAudienceMode(event.target.value as AudienceMode)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
            >
              {AUDIENCE_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {audienceLabel(mode)}
                </option>
              ))}
            </select>
          </label>
          {audienceMode === 'SEGMENTS' && (
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
        </div>
      )}

      <Button variant="primary" disabled={!isValid || sendMutation.isPending} onClick={() => sendMutation.mutate()}>
        Send
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}

function RecipientRow({ recipient }: { recipient: backendApi.PushNotificationRecipient }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-xs">
      <span className="min-w-0 truncate">{recipient.user.username}</span>
      <span className={recipient.status === 'SENT' ? 'text-highlight' : 'text-danger'}>
        {recipient.status === 'SENT' ? 'Sent' : `Failed${recipient.statusCode ? ` (${recipient.statusCode})` : ''}`}
      </span>
    </div>
  );
}

function PushNotificationCard({ notification }: { notification: backendApi.PushNotification }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: detail } = useQuery({
    queryKey: ['push-notifications', notification.id],
    queryFn: () => backendApi.getPushNotification(notification.id),
    enabled: isExpanded,
  });

  return (
    <Card className="p-0">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{notification.title}</span>
          <span className="block text-xs text-text-secondary">
            {kindLabel(notification.kind)} · {notification._count.recipients} recipient
            {notification._count.recipients === 1 ? '' : 's'} ·{' '}
            {new Date(notification.createdAt).toLocaleString()}
          </span>
        </span>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="space-y-2 border-t border-border p-4 pt-3">
          <p className="text-sm text-text-secondary">{notification.body}</p>
          {notification.sentByUsername && (
            <p className="text-xs text-text-muted">Sent by {notification.sentByUsername}</p>
          )}
          {!detail && (
            <div className="space-y-1" aria-label="Loading recipients" role="status">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
            </div>
          )}
          {detail && detail.recipients.length === 0 && (
            <p className="text-sm text-text-secondary">No recipients (empty audience).</p>
          )}
          {detail && detail.recipients.length > 0 && (
            <div className="space-y-1">
              {detail.recipients.map((recipient) => (
                <RecipientRow key={recipient.id} recipient={recipient} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function PushNotificationsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = location.state as CampaignPrefillState | undefined;

  const {
    data: notifications,
    isPending,
    isError,
  } = useQuery({ queryKey: pushNotificationsQueryKey, queryFn: backendApi.listPushNotifications });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Push notifications</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Compose a custom push (targeted at everyone or specific player segments), or arrive here from a Bet & Get
        or Deposit campaign's "Send push for this campaign" button to send one whose audience is that campaign's
        own targeting. Bet-settled-WON pushes send automatically and show up in the history below too.
      </p>

      <div className="mt-4 space-y-4">
        {prefill && (prefill.betAndGetCampaignId || prefill.depositCampaignId) && (
          <button
            type="button"
            onClick={() => navigate('/push-notifications', { replace: true })}
            className="text-xs text-text-secondary hover:underline"
          >
            Clear campaign link and compose a custom push instead
          </button>
        )}
        <ComposePushForm prefill={prefill} />

        {isPending && (
          <div className="space-y-2" aria-label="Loading push notifications" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load push notification history.</p>}
        {!isPending && notifications?.length === 0 && (
          <p className="text-sm text-text-secondary">No push notifications sent yet.</p>
        )}
        <div className="space-y-2">
          {notifications?.map((notification) => (
            <PushNotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      </div>
    </div>
  );
}

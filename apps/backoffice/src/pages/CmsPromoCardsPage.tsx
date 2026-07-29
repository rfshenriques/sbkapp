import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { toast, errorMessage } from '../features/toast/toastStore';
import * as backendApi from '../lib/backendApi';

const promoCardsQueryKey = ['promo-cards'] as const;
const campaignsQueryKey = ['bet-and-get-campaigns'] as const;
const depositCampaignsQueryKey = ['deposit-campaigns'] as const;
const homepageCarouselConfigQueryKey = ['homepage-carousel-config'] as const;
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

/**
 * Controls the homepage's "Match of the day + Promotions" row: on mobile the
 * combined swipeable block, on desktop just the Promotions side (Match of
 * the day stays fixed there) - see apps/frontend's OddsBoardPage.
 */
function HomepageCarouselSettings() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: homepageCarouselConfigQueryKey,
    queryFn: backendApi.getHomepageCarouselConfig,
  });
  const [draft, setDraft] = useState<backendApi.HomepageCarouselConfig | null>(null);

  useEffect(() => {
    if (data && draft === null) {
      setDraft(data);
    }
  }, [data, draft]);

  const saveMutation = useMutation({
    mutationFn: (config: backendApi.HomepageCarouselConfig) => backendApi.setHomepageCarouselConfig(config),
    onSuccess: (saved) => {
      setDraft(saved);
      void queryClient.invalidateQueries({ queryKey: homepageCarouselConfigQueryKey });
      toast.success('Auto-scroll settings saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save auto-scroll settings')),
  });

  const isValid = draft !== null && Number.isInteger(draft.autoScrollSeconds) && draft.autoScrollSeconds >= 3;

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">Homepage auto-scroll</h2>
      <p className="text-xs text-text-secondary">
        Automatically cycles through the cards in that row - Match of the day and Promotions together on
        mobile, just Promotions on desktop.
      </p>

      {isPending && (
        <div className="space-y-2" aria-label="Loading content" role="status">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      {draft && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
            />
            Enabled
          </label>

          <div className="max-w-xs">
            <label htmlFor="carousel-auto-scroll-seconds" className="block text-xs text-text-secondary">
              Auto-scroll every N seconds
            </label>
            <input
              id="carousel-auto-scroll-seconds"
              type="text"
              inputMode="numeric"
              value={draft.autoScrollSeconds}
              onChange={(event) => setDraft({ ...draft, autoScrollSeconds: Number(event.target.value) })}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
            />
          </div>

          <Button
            variant="primary"
            disabled={!isValid || saveMutation.isPending}
            onClick={() => draft && saveMutation.mutate(draft)}
          >
            Save auto-scroll settings
          </Button>
        </>
      )}
    </Card>
  );
}

interface CampaignSelection {
  betAndGetCampaignId: string;
  depositCampaignId: string;
}

const NONE_VALUE = '';

function encodeCampaignValue(selection: CampaignSelection): string {
  if (selection.betAndGetCampaignId) return `bet-and-get:${selection.betAndGetCampaignId}`;
  if (selection.depositCampaignId) return `deposit:${selection.depositCampaignId}`;
  return NONE_VALUE;
}

function decodeCampaignValue(value: string): CampaignSelection {
  if (value.startsWith('bet-and-get:')) {
    return { betAndGetCampaignId: value.slice('bet-and-get:'.length), depositCampaignId: '' };
  }
  if (value.startsWith('deposit:')) {
    return { betAndGetCampaignId: '', depositCampaignId: value.slice('deposit:'.length) };
  }
  return { betAndGetCampaignId: '', depositCampaignId: '' };
}

function CampaignSelect({
  id,
  selection,
  onChange,
  betAndGetCampaigns,
  depositCampaigns,
}: {
  id: string;
  selection: CampaignSelection;
  onChange: (selection: CampaignSelection) => void;
  betAndGetCampaigns: backendApi.BetAndGetCampaign[];
  depositCampaigns: backendApi.DepositCampaign[];
}) {
  return (
    <select
      id={id}
      value={encodeCampaignValue(selection)}
      onChange={(event) => onChange(decodeCampaignValue(event.target.value))}
      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
    >
      <option value={NONE_VALUE}>No campaign (decorative only)</option>
      {betAndGetCampaigns.length > 0 && (
        <optgroup label="Bet & Get">
          {betAndGetCampaigns.map((campaign) => (
            <option key={campaign.id} value={`bet-and-get:${campaign.id}`}>
              {campaign.name}
            </option>
          ))}
        </optgroup>
      )}
      {depositCampaigns.length > 0 && (
        <optgroup label="Deposit">
          {depositCampaigns.map((campaign) => (
            <option key={campaign.id} value={`deposit:${campaign.id}`}>
              {campaign.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function NewPromoCardForm({
  betAndGetCampaigns,
  depositCampaigns,
}: {
  betAndGetCampaigns: backendApi.BetAndGetCampaign[];
  depositCampaigns: backendApi.DepositCampaign[];
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [selection, setSelection] = useState<CampaignSelection>({ betAndGetCampaignId: '', depositCampaignId: '' });
  const [error, setError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: () =>
      backendApi.addPromoCard({
        file: file as File,
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        betAndGetCampaignId: selection.betAndGetCampaignId || undefined,
        depositCampaignId: selection.depositCampaignId || undefined,
      }),
    onSuccess: () => {
      setFile(null);
      setTitle('');
      setSubtitle('');
      setSelection({ betAndGetCampaignId: '', depositCampaignId: '' });
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      void queryClient.invalidateQueries({ queryKey: promoCardsQueryKey });
      toast.success('Promo card added');
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      toast.error(errorMessage(mutationError, 'Failed to add promo card'));
    },
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">New promo card</h2>
      <p className="text-xs text-text-secondary">
        Shown on the homepage and Promotions page. Link it to a Bet & Get or deposit campaign to make it
        clickable, or leave unlinked for a purely decorative card.
      </p>

      <div>
        <label className="block text-xs text-text-secondary" htmlFor="promo-card-file">
          Image
        </label>
        <input
          id="promo-card-file"
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          className="mt-1 w-full text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-text-secondary" htmlFor="promo-card-title">
            Title (optional)
          </label>
          <input
            id="promo-card-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary" htmlFor="promo-card-subtitle">
            Subtitle (optional)
          </label>
          <input
            id="promo-card-subtitle"
            type="text"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-text-secondary" htmlFor="promo-card-campaign">
          Linked campaign
        </label>
        <div className="mt-1">
          <CampaignSelect
            id="promo-card-campaign"
            selection={selection}
            onChange={setSelection}
            betAndGetCampaigns={betAndGetCampaigns}
            depositCampaigns={depositCampaigns}
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button variant="primary" disabled={!file || addMutation.isPending} onClick={() => addMutation.mutate()}>
        {addMutation.isPending ? 'Uploading…' : 'Add promo card'}
      </Button>
    </Card>
  );
}

function PromoCardRow({
  card,
  betAndGetCampaigns,
  depositCampaigns,
  isDragged,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  card: backendApi.PromoCard;
  betAndGetCampaigns: backendApi.BetAndGetCampaign[];
  depositCampaigns: backendApi.DepositCampaign[];
  isDragged: boolean;
  onDragStart: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState(card.title ?? '');
  const [subtitle, setSubtitle] = useState(card.subtitle ?? '');
  const [selection, setSelection] = useState<CampaignSelection>({
    betAndGetCampaignId: card.betAndGetCampaignId ?? '',
    depositCampaignId: card.depositCampaignId ?? '',
  });
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(card.title ?? '');
    setSubtitle(card.subtitle ?? '');
    setSelection({
      betAndGetCampaignId: card.betAndGetCampaignId ?? '',
      depositCampaignId: card.depositCampaignId ?? '',
    });
  }, [card]);

  const saveMutation = useMutation({
    mutationFn: () =>
      backendApi.updatePromoCard(card.id, {
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        betAndGetCampaignId: selection.betAndGetCampaignId || null,
        depositCampaignId: selection.depositCampaignId || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promoCardsQueryKey });
      toast.success('Promo card updated');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update promo card')),
  });

  const removeMutation = useMutation({
    mutationFn: () => backendApi.removePromoCard(card.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promoCardsQueryKey });
      toast.success('Promo card removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove promo card')),
  });

  const imageMutation = useMutation({
    mutationFn: (file: File) => backendApi.updatePromoCardImage(card.id, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promoCardsQueryKey });
      toast.success('Promo card image updated');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update promo card image')),
    onSettled: () => {
      if (imageInputRef.current) imageInputRef.current.value = '';
    },
  });

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) imageMutation.mutate(file);
  }

  const linkedCampaign =
    betAndGetCampaigns.find((campaign) => campaign.id === card.betAndGetCampaignId) ??
    depositCampaigns.find((campaign) => campaign.id === card.depositCampaignId);
  const isDirty =
    title.trim() !== (card.title ?? '') ||
    subtitle.trim() !== (card.subtitle ?? '') ||
    selection.betAndGetCampaignId !== (card.betAndGetCampaignId ?? '') ||
    selection.depositCampaignId !== (card.depositCampaignId ?? '');

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`rounded-md bg-background ${isDragged ? 'opacity-40' : ''}`}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span className="cursor-grab select-none text-text-muted" aria-hidden="true" title="Drag to reorder">
          ⠿
        </span>
        <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface">
          {card.mimeType ? (
            <img
              src={`/backend/public/promo-cards/${card.brandId}/item/${card.id}`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-1 text-center text-[10px] leading-tight text-text-muted">No image</span>
          )}
        </div>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{card.title || '(no title)'}</span>
          <span className="block truncate text-xs text-text-secondary">
            {linkedCampaign ? `Links to: ${linkedCampaign.name}` : 'Decorative - no campaign link'}
          </span>
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-3 border-t border-border p-3 pt-3">
          <div>
            <label className="block text-xs text-text-secondary" htmlFor={`image-${card.id}`}>
              {card.mimeType ? 'Replace image' : 'Add image'}
              {card.autoCreated && !card.mimeType && ' (auto-created, no artwork uploaded yet)'}
            </label>
            <input
              id={`image-${card.id}`}
              ref={imageInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleImageChange}
              disabled={imageMutation.isPending}
              className="mt-1 w-full text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-text-secondary" htmlFor={`title-${card.id}`}>
                Title
              </label>
              <input
                id={`title-${card.id}`}
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary" htmlFor={`subtitle-${card.id}`}>
                Subtitle
              </label>
              <input
                id={`subtitle-${card.id}`}
                type="text"
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary" htmlFor={`campaign-${card.id}`}>
              Linked campaign
            </label>
            <div className="mt-1">
              <CampaignSelect
                id={`campaign-${card.id}`}
                selection={selection}
                onChange={setSelection}
                betAndGetCampaigns={betAndGetCampaigns}
                depositCampaigns={depositCampaigns}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={!isDirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Save
            </Button>
            <Button variant="ghost" onClick={() => removeMutation.mutate()} disabled={removeMutation.isPending}>
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CmsPromoCardsPage() {
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // Only set mid-drag, so the row order can move instantly instead of
  // waiting on a round trip - cleared once the reorder mutation settles.
  const [dragOrder, setDragOrder] = useState<backendApi.PromoCard[] | null>(null);

  const { data: cards, isPending, isError } = useQuery({
    queryKey: promoCardsQueryKey,
    queryFn: backendApi.listPromoCards,
  });
  const { data: campaigns } = useQuery({
    queryKey: campaignsQueryKey,
    queryFn: backendApi.listBetAndGetCampaigns,
  });
  const { data: depositCampaigns } = useQuery({
    queryKey: depositCampaignsQueryKey,
    queryFn: backendApi.listDepositCampaigns,
  });

  const orderedCards = useMemo(
    () => dragOrder ?? [...(cards ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [dragOrder, cards],
  );

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => backendApi.reorderPromoCards(ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promoCardsQueryKey });
      setDragOrder(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to reorder promo cards')),
  });

  function allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(targetIndex: number) {
    if (!draggedId) return;
    const fromIndex = orderedCards.findIndex((card) => card.id === draggedId);
    if (fromIndex === -1 || fromIndex === targetIndex) return;

    const next = [...orderedCards];
    const moved = next.splice(fromIndex, 1)[0];
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setDragOrder(next);
    reorderMutation.mutate(next.map((card) => card.id));
    setDraggedId(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">CMS: Promo cards</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Promotional cards for the homepage and Promotions page. Link a card to a Bet & Get campaign to make it
        clickable through to that campaign's matches, or to a deposit campaign to open its deposit modal, or
        leave it unlinked for a purely decorative card.
      </p>

      <div className="mt-4 space-y-4">
        <HomepageCarouselSettings />
        <NewPromoCardForm betAndGetCampaigns={campaigns ?? []} depositCampaigns={depositCampaigns ?? []} />

        {isPending && (
          <div className="space-y-2" aria-label="Loading content" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load promo cards.</p>}
        {!isPending && orderedCards.length === 0 && (
          <p className="text-sm text-text-secondary">No promo cards yet - add one above.</p>
        )}

        {orderedCards.length > 0 && (
          <Card className="space-y-1 p-1">
            {orderedCards.map((card, index) => (
              <PromoCardRow
                key={card.id}
                card={card}
                betAndGetCampaigns={campaigns ?? []}
                depositCampaigns={depositCampaigns ?? []}
                isDragged={draggedId === card.id}
                onDragStart={() => setDraggedId(card.id)}
                onDragOver={allowDrop}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => setDraggedId(null)}
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

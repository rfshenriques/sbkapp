import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';

const promoCardsQueryKey = ['promo-cards'] as const;
const campaignsQueryKey = ['bet-and-get-campaigns'] as const;
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

function CampaignSelect({
  id,
  value,
  onChange,
  campaigns,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  campaigns: backendApi.BetAndGetCampaign[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
    >
      <option value="">No campaign (decorative only)</option>
      {campaigns.map((campaign) => (
        <option key={campaign.id} value={campaign.id}>
          {campaign.name}
        </option>
      ))}
    </select>
  );
}

function NewPromoCardForm({ campaigns }: { campaigns: backendApi.BetAndGetCampaign[] }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [betAndGetCampaignId, setBetAndGetCampaignId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: () =>
      backendApi.addPromoCard({
        file: file as File,
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        betAndGetCampaignId: betAndGetCampaignId || undefined,
      }),
    onSuccess: () => {
      setFile(null);
      setTitle('');
      setSubtitle('');
      setBetAndGetCampaignId('');
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      void queryClient.invalidateQueries({ queryKey: promoCardsQueryKey });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">New promo card</h2>
      <p className="text-xs text-text-secondary">
        Shown on the homepage and Promotions page. Link it to a Bet & Get campaign to make it clickable, or
        leave unlinked for a purely decorative card.
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
            value={betAndGetCampaignId}
            onChange={setBetAndGetCampaignId}
            campaigns={campaigns}
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
  campaigns,
  isDragged,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  card: backendApi.PromoCard;
  campaigns: backendApi.BetAndGetCampaign[];
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
  const [betAndGetCampaignId, setBetAndGetCampaignId] = useState(card.betAndGetCampaignId ?? '');

  useEffect(() => {
    setTitle(card.title ?? '');
    setSubtitle(card.subtitle ?? '');
    setBetAndGetCampaignId(card.betAndGetCampaignId ?? '');
  }, [card]);

  const saveMutation = useMutation({
    mutationFn: () =>
      backendApi.updatePromoCard(card.id, {
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        betAndGetCampaignId: betAndGetCampaignId || null,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: promoCardsQueryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: () => backendApi.removePromoCard(card.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: promoCardsQueryKey }),
  });

  const linkedCampaign = campaigns.find((campaign) => campaign.id === card.betAndGetCampaignId);
  const isDirty =
    title.trim() !== (card.title ?? '') ||
    subtitle.trim() !== (card.subtitle ?? '') ||
    betAndGetCampaignId !== (card.betAndGetCampaignId ?? '');

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
          <img
            src={`/backend/public/promo-cards/${card.brandId}/item/${card.id}`}
            alt=""
            className="h-full w-full object-cover"
          />
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
                value={betAndGetCampaignId}
                onChange={setBetAndGetCampaignId}
                campaigns={campaigns}
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
        Promotional cards for the homepage and Promotions page. Link a card to a Bet & Get campaign to make
        it clickable through to that campaign's matches, or leave it unlinked for a purely decorative card.
      </p>

      <div className="mt-4 space-y-4">
        <NewPromoCardForm campaigns={campaigns ?? []} />

        {isPending && <p className="text-sm text-text-secondary">Loading…</p>}
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
                campaigns={campaigns ?? []}
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

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';

const imagesQueryKey = ['brand-images'] as const;
const imageListQueryKey = (kind: backendApi.BrandImageListKind) => ['brand-image-list', kind] as const;

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';
const ACCEPTED_LIST_TYPES = 'image/png,image/jpeg,image/webp,image/svg+xml';

type Tab = 'slots' | 'SPONSOR_LOGO' | 'PAYMENT_METHOD';

const LIST_TABS: { kind: 'SPONSOR_LOGO' | 'PAYMENT_METHOD'; label: string; description: string }[] = [
  {
    kind: 'SPONSOR_LOGO',
    label: 'Sponsor logos',
    description: "Shown in the player app's footer, in the order below.",
  },
  {
    kind: 'PAYMENT_METHOD',
    label: 'Payment methods',
    description: "Shown in the player app's footer, in the order below. The footer section stays hidden until at least one is uploaded.",
  },
];

function ImageListSection({ kind, description }: { kind: 'SPONSOR_LOGO' | 'PAYMENT_METHOD'; description: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // Only set mid-drag, so the row order can move instantly instead of
  // waiting on a round trip - cleared once the reorder mutation settles
  // and the refetched server order takes back over.
  const [dragOrder, setDragOrder] = useState<backendApi.BrandImageListItem[] | null>(null);

  const queryKey = imageListQueryKey(kind);
  const { data: items, isPending, isError } = useQuery({
    queryKey,
    queryFn: () => backendApi.listBrandImageList(kind),
  });

  const orderedItems = useMemo(
    () => dragOrder ?? [...(items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [dragOrder, items],
  );

  const addMutation = useMutation({
    mutationFn: (file: File) => backendApi.addBrandImageListItem(kind, file),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => backendApi.removeBrandImageListItem(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => backendApi.reorderBrandImageList(kind, ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setDragOrder(null);
    },
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      addMutation.mutate(file);
    }
  }

  function allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(targetIndex: number) {
    if (!draggedId) return;
    const fromIndex = orderedItems.findIndex((item) => item.id === draggedId);
    if (fromIndex === -1 || fromIndex === targetIndex) return;

    const next = [...orderedItems];
    const moved = next.splice(fromIndex, 1)[0];
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setDragOrder(next);
    reorderMutation.mutate(next.map((item) => item.id));
    setDraggedId(null);
  }

  return (
    <div>
      <p className="mb-3 text-sm text-text-secondary">{description}</p>

      {isPending && <p className="text-sm text-text-secondary">Loading…</p>}
      {isError && <p className="text-sm text-danger">Failed to load images.</p>}
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {!isPending && orderedItems.length === 0 && (
        <p className="mb-3 text-sm text-text-secondary">Nothing uploaded yet.</p>
      )}

      {orderedItems.length > 0 && (
        <Card className="mb-3 space-y-1">
          {orderedItems.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDraggedId(item.id)}
              onDragOver={allowDrop}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => setDraggedId(null)}
              className={`flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2 ${
                draggedId === item.id ? 'opacity-40' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="cursor-grab select-none text-text-muted" aria-hidden="true" title="Drag to reorder">
                  ⠿
                </span>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface">
                  <img
                    src={`/backend/public/brand-image-list/${item.brandId}/item/${item.id}`}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => removeMutation.mutate(item.id)}
                disabled={removeMutation.isPending}
              >
                Remove
              </Button>
            </div>
          ))}
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_LIST_TYPES}
        className="hidden"
        aria-label={`Upload image for ${kind === 'SPONSOR_LOGO' ? 'sponsor logos' : 'payment methods'}`}
        onChange={handleFileChange}
      />
      <Button variant="secondary" disabled={addMutation.isPending} onClick={() => fileInputRef.current?.click()}>
        {addMutation.isPending ? 'Uploading…' : 'Add image'}
      </Button>
    </div>
  );
}

const SLOTS: { slot: backendApi.BrandImageSlot; label: string; recommendation: string; usage: string }[] = [
  {
    slot: 'REGISTER_DESKTOP',
    label: 'Register - desktop',
    recommendation: '800 × 1000px (4:5, portrait)',
    usage: 'The promo panel beside the register form on wider screens.',
  },
  {
    slot: 'REGISTER_MOBILE',
    label: 'Register - mobile',
    recommendation: '800 × 300px (8:3, wide banner)',
    usage: 'The short strip above the register form on phones.',
  },
  {
    slot: 'HOMEPAGE_OFFER',
    label: 'Homepage offer',
    recommendation: '800 × 800px (1:1, square)',
    usage: "The homepage's promo card next to (desktop) or alongside (mobile) the featured match.",
  },
  {
    slot: 'MATCH_OF_THE_DAY',
    label: 'Match of the day background',
    recommendation: '1200 × 600px (2:1, landscape)',
    usage: "Background photo behind the homepage's featured \"Match of the day\" hero card.",
  },
];

function SlotRow({
  slot,
  label,
  recommendation,
  usage,
  image,
}: {
  slot: backendApi.BrandImageSlot;
  label: string;
  recommendation: string;
  usage: string;
  image: backendApi.BrandImage | undefined;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => backendApi.uploadBrandImage(slot, file),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: imagesQueryKey });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const removeMutation = useMutation({
    mutationFn: () => backendApi.removeBrandImage(slot),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: imagesQueryKey }),
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      uploadMutation.mutate(file);
    }
  }

  const previewUrl = image
    ? `/backend/public/brand-images/${image.brandId}/${slot}?v=${encodeURIComponent(image.updatedAt)}`
    : null;

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
          {previewUrl ? (
            <img src={previewUrl} alt={`${label} preview`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-text-muted">No image</span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-text-secondary">{usage}</p>
          <p className="text-xs text-text-muted">Recommended: {recommendation}</p>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          aria-label={`Upload ${label} image`}
          onChange={handleFileChange}
        />
        <Button
          variant="secondary"
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadMutation.isPending ? 'Uploading…' : image ? 'Replace' : 'Upload'}
        </Button>
        {image && (
          <Button
            variant="ghost"
            disabled={removeMutation.isPending}
            onClick={() => removeMutation.mutate()}
          >
            Remove
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function CmsImagesPage() {
  const [tab, setTab] = useState<Tab>('slots');

  const { data: images, isPending, isError } = useQuery({
    queryKey: imagesQueryKey,
    queryFn: backendApi.listBrandImages,
  });

  const imageBySlot = new Map((images ?? []).map((image) => [image.slot, image]));

  return (
    <div>
      <h1 className="text-2xl font-semibold">CMS images</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Upload the promo images used across the player-facing app. PNG, JPEG, or WebP, up to 5MB.
      </p>

      <div className="mt-4 flex gap-2" role="group" aria-label="Image category">
        <Button variant={tab === 'slots' ? 'primary' : 'secondary'} aria-pressed={tab === 'slots'} onClick={() => setTab('slots')}>
          Promo images
        </Button>
        {LIST_TABS.map(({ kind, label }) => (
          <Button
            key={kind}
            variant={tab === kind ? 'primary' : 'secondary'}
            aria-pressed={tab === kind}
            onClick={() => setTab(kind)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === 'slots' && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-text-secondary">
            Each slot below shows where it's used and its recommended resolution, so nothing gets
            uploaded at the wrong size.
          </p>
          {isPending && <p className="text-sm text-text-secondary">Loading images…</p>}
          {isError && <p className="text-sm text-danger">Failed to load images.</p>}
          {!isPending &&
            !isError &&
            SLOTS.map(({ slot, label, recommendation, usage }) => (
              <SlotRow
                key={slot}
                slot={slot}
                label={label}
                recommendation={recommendation}
                usage={usage}
                image={imageBySlot.get(slot)}
              />
            ))}
        </div>
      )}

      {LIST_TABS.map(
        ({ kind, description }) =>
          tab === kind && (
            <div key={kind} className="mt-4">
              <ImageListSection kind={kind} description={description} />
            </div>
          ),
      )}
    </div>
  );
}

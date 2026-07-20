import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';

const imagesQueryKey = ['brand-images'] as const;

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

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
  const { data: images, isPending, isError } = useQuery({
    queryKey: imagesQueryKey,
    queryFn: backendApi.listBrandImages,
  });

  const imageBySlot = new Map((images ?? []).map((image) => [image.slot, image]));

  return (
    <div>
      <h1 className="text-2xl font-semibold">CMS images</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Upload the promo images used on the player-facing register page and homepage. PNG, JPEG, or
        WebP, up to 5MB. Each slot below shows where it's used and its recommended resolution, so
        nothing gets uploaded at the wrong size.
      </p>

      <div className="mt-4 space-y-3">
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
    </div>
  );
}

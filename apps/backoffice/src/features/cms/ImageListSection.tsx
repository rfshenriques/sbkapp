import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import * as backendApi from '../../lib/backendApi';

const imageListQueryKey = (kind: backendApi.BrandImageListKind) => ['brand-image-list', kind] as const;

const ACCEPTED_LIST_TYPES = 'image/png,image/jpeg,image/webp,image/svg+xml';

/** An ordered, staff-uploaded image list - sponsor logos or payment method icons, both shown in the player app's footer. Reused by the CMS Sponsors and Payments pages, only the kind/description differ. */
export function ImageListSection({
  kind,
  description,
}: {
  kind: 'SPONSOR_LOGO' | 'PAYMENT_METHOD';
  description: string;
}) {
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

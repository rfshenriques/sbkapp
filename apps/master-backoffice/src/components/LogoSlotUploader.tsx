import type { ChangeEvent } from 'react';
import { Button } from './ui/Button';

interface LogoSlotUploaderProps {
  label: string;
  inputId: string;
  url: string | null;
  isUploading: boolean;
  isRemoving: boolean;
  onFileSelected: (file: File) => void;
  onRemove: () => void;
}

/** One of a brand's 4 uploadable logo slots (site/share x light/dark) - a live preview, a file picker that uploads immediately on selection, and a remove button once one exists. */
export function LogoSlotUploader({
  label,
  inputId,
  url,
  isUploading,
  isRemoving,
  onFileSelected,
  onRemove,
}: LogoSlotUploaderProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onFileSelected(file);
  }

  return (
    <div>
      <p className="text-xs text-text-secondary">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        {url ? (
          <img
            src={url}
            alt={`${label} preview`}
            className="h-10 max-w-[8rem] rounded-md border border-border bg-background object-contain p-1"
          />
        ) : (
          <span className="flex h-10 w-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-text-muted">
            None
          </span>
        )}
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-hover"
        >
          {isUploading ? 'Uploading…' : 'Upload'}
          <input
            id={inputId}
            aria-label={label}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleChange}
            disabled={isUploading}
            className="sr-only"
          />
        </label>
        {url && (
          <Button type="button" variant="ghost" disabled={isRemoving} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

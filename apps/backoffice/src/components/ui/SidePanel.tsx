import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useScrollLock } from '../../lib/useScrollLock';

interface SidePanelProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Generic right-hand slide-over for drilling into a single record (a bet ticket today, likely a transaction or a KYC case later) without leaving the list it was opened from. */
export function SidePanel({ title, isOpen, onClose, children }: SidePanelProps) {
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useToastStore, type Toast } from './toastStore';

const AUTO_DISMISS_MS = 4000;

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  const isSuccess = toast.variant === 'success';

  return (
    <div
      role="status"
      className="animate-toast-in flex items-start gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 shadow-lg"
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          isSuccess ? 'bg-brand text-slate-950' : 'bg-danger text-white'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
          {isSuccess ? <path d="M4.5 10.5 8 14l7.5-8" /> : <path d="M6 6l8 8M14 6l-8 8" />}
        </svg>
      </span>
      <p className="flex-1 text-sm text-text-primary">{toast.message}</p>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-text-muted transition-colors hover:text-text-primary"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </div>
  );
}

/** Mounted once in AppShell - every page pushes into this via toast.success/toast.error, no per-page wiring. */
export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full max-w-sm">
          <ToastRow toast={toast} />
        </div>
      ))}
    </div>
  );
}

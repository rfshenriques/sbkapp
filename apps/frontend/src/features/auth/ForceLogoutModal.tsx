import { useEffect } from 'react';
import { LockIcon } from '../../components/ui/LockIcon';
import { useForceLogoutModalStore } from './forceLogoutModalStore';

const AUTO_CLOSE_MS = 4000;

/**
 * A brief, self-dismissing toast confirming a logout the player didn't
 * click themselves (idle timeout, tab backgrounded - see useForceLogout) -
 * otherwise a session ending mid-browse with no explanation just looks
 * like a bug. Never shown for a manual "Log out" click, which already has
 * its own clear confirmation (the login screen appearing).
 */
export function ForceLogoutModal() {
  const isOpen = useForceLogoutModalStore((state) => state.isOpen);
  const close = useForceLogoutModalStore((state) => state.close);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(close, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fade-in-up fixed inset-x-0 top-4 z-50 flex justify-center px-4"
    >
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg">
        <LockIcon width={18} height={18} className="shrink-0 text-text-secondary" />
        <p className="text-sm font-semibold">You have been logged out</p>
      </div>
    </div>
  );
}

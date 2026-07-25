import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountIcon, MyBetsIcon } from '../../components/ui/NavIcons';
import { cn } from '../../lib/cn';
import { useAuth } from './useAuth';

/**
 * Replaces the old plain "Log out" header button - a silhouette trigger
 * that opens a small floating menu (account identity + real player-facing
 * destinations), with Log out itself styled as plain red text rather than
 * a button, since it's the one destructive/exit action in the list.
 */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Account menu"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-text-secondary transition-colors hover:text-text-primary',
          isOpen && 'text-highlight',
        )}
      >
        <AccountIcon width={18} height={18} />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Account"
          className="fade-in-down absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-border bg-surface py-2 shadow-lg"
        >
          <div className="border-b border-border px-3.5 pb-2.5">
            <p className="truncate font-display text-sm">{user?.username}</p>
            <p className="truncate text-xs text-text-muted">{user?.email}</p>
          </div>
          <div className="py-1.5">
            <Link
              to="/my-bets"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3.5 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              <MyBetsIcon width={16} height={16} />
              My Bets
            </Link>
            <Link
              to="/responsible-gambling"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3.5 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Responsible Gambling
            </Link>
          </div>
          <div className="border-t border-border pt-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                void logout();
              }}
              className="w-full px-3.5 py-2 text-left text-sm font-semibold text-danger"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

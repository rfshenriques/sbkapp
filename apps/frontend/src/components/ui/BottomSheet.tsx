import type { ReactNode } from 'react';

export interface BottomSheetProps {
  title: string;
  /** e.g. the brand-flag tri-bar mark, rendered before the title text. */
  icon?: ReactNode;
  onClose: () => void;
  /** aria-label shared by both the backdrop and the explicit ✕ button. */
  closeLabel: string;
  /** Extra content under the title row (e.g. the bet slip's balance line). */
  headerExtra?: ReactNode;
  /** Fixed at the bottom, outside the scrollable body - a submit button is never scrolled out of reach. */
  footer?: ReactNode;
  children: ReactNode;
  /** Override the body wrapper's own scroll/padding when the child already manages that itself (BetSlipPanel does). */
  bodyClassName?: string;
}

/**
 * Shared bottom-to-top sheet for every modal-as-a-route in the app (login,
 * register, the mobile bet slip) - full viewport width and 80% height at
 * every breakpoint, sliding up from the bottom, with its primary action
 * fixed in a footer rather than scrolling away with the body content.
 */
export function BottomSheet({
  title,
  icon,
  onClose,
  closeLabel,
  headerExtra,
  footer,
  children,
  bodyClassName,
}: BottomSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* dvh, not vh: on real mobile browsers vh is pinned to the largest
          (address-bar-collapsed) viewport, so with the address bar visible
          - the common case right after opening - an 80vh sheet reads as
          taller than the actual visible area and gets clipped. dvh tracks
          the browser chrome's current state instead. */}
      <div className="sheet-slide-up relative flex h-[80dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-surface">
        <div className="shrink-0 border-b border-border p-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {icon}
              <h1 className="font-display text-xl">{title}</h1>
            </div>
            <button
              type="button"
              aria-label={closeLabel}
              className="text-text-muted hover:text-text-primary"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          {headerExtra}
        </div>
        <div className={bodyClassName ?? 'scrollbar-hide min-h-0 flex-1 overflow-y-auto p-4'}>{children}</div>
        {footer && <div className="shrink-0 border-t border-border p-4 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

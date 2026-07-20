import { useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

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
  /** Override the body wrapper's own scroll/padding when the child already manages that itself (BetSlipPanel does, and Register's image+fields split does). */
  bodyClassName?: string;
  /**
   * Desktop (sm+) only - mobile is always a full-width bottom sheet
   * regardless. 'default' is a small, page-centered dialog (Login).
   * 'wide' gives Register's promo-image + fields split enough room to sit
   * side by side instead of stacking the way mobile does.
   */
  desktopSize?: 'default' | 'wide';
}

const desktopMaxWidth: Record<NonNullable<BottomSheetProps['desktopSize']>, string> = {
  default: 'sm:max-w-md',
  wide: 'sm:max-w-3xl',
};

/**
 * Shared modal presentation for every route-as-a-modal in the app (login,
 * register, the mobile bet slip). Mobile is always a bottom-to-top sheet -
 * full viewport width and 80% height. Desktop (sm+) is a smaller,
 * page-centered dialog instead: a full-bleed sheet reads as oversized once
 * there's room for it to just be a normal modal.
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
  desktopSize = 'default',
}: BottomSheetProps) {
  // A background page tall enough to scroll would otherwise keep scrolling
  // underneath the sheet once the sheet's own content hits its scroll
  // limit - lock it for as long as this sheet is mounted.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
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
          the browser chrome's current state instead. Desktop drops the fixed
          height for an auto one capped by max-h, since a small centered
          dialog should size to its content, not always fill 80% of screen. */}
      <div
        className={cn(
          'sheet-slide-up relative flex h-[80dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-surface sm:h-auto sm:max-h-[85vh] sm:rounded-3xl',
          desktopMaxWidth[desktopSize],
        )}
      >
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
        <div className={bodyClassName ?? 'scrollbar-hide min-h-0 flex-1 overflow-y-auto p-4'}>
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-border p-4 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

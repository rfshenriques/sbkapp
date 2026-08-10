import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { cn } from '../../lib/cn';
import { useScrollLock } from '../../lib/useScrollLock';
import { CloseIcon } from './CloseIcon';

/** Drag the handle down past this many px on mobile and releasing closes the sheet. */
const CLOSE_DRAG_THRESHOLD_PX = 110;

export interface BottomSheetProps {
  title: string;
  /** A small contextual icon (e.g. AccountIcon, WalletIcon), rendered before the title text. */
  icon?: ReactNode;
  onClose: () => void;
  /** aria-label shared by both the backdrop and the circular close button. */
  closeLabel: string;
  /** When set, renders a circular back-chevron button before the icon/title, for a sheet that swaps between an internal menu and a sub-view (e.g. AccountMenu's Settings) instead of navigating to a separate route - closing the whole sheet stays available via the X regardless. */
  onBack?: () => void;
  /** aria-label for the back button - required together with onBack. */
  backLabel?: string;
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
  /**
   * Mobile-only sheet height (dvh unit class, e.g. 'h-[80dvh]') - the bet
   * slip opts into a taller sheet since its alerts/promo bars (stake-limit
   * warnings, acca boost/rollback bars, insurance toggle) eat into the
   * visible scroll area more than login/register's plain form fields do.
   */
  mobileHeightClassName?: string;
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
  onBack,
  backLabel,
  headerExtra,
  footer,
  children,
  bodyClassName,
  desktopSize = 'default',
  mobileHeightClassName = 'h-[80dvh]',
}: BottomSheetProps) {
  // A background page tall enough to scroll would otherwise keep scrolling
  // underneath the sheet once the sheet's own content hits its scroll
  // limit - lock it for as long as this sheet is mounted.
  useScrollLock(true);

  // Mobile-only drag-to-dismiss: track the handle's vertical offset while
  // dragging, then either snap back or close on release depending on the
  // threshold. Desktop's centered dialog doesn't get this gesture at all.
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const latestDragYRef = useRef(0);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    dragStartYRef.current = event.touches[0]?.clientY ?? 0;
    latestDragYRef.current = 0;
    setIsDragging(true);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const currentY = event.touches[0]?.clientY ?? 0;
    const offset = Math.max(0, currentY - dragStartYRef.current);
    latestDragYRef.current = offset;
    setDragY(offset);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (latestDragYRef.current > CLOSE_DRAG_THRESHOLD_PX) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={closeLabel}
        className="backdrop-fade-in absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/80 backdrop-blur-sm"
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
          'sheet-slide-up relative flex w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-surface sm:h-auto sm:max-h-[85vh] sm:rounded-3xl',
          !isDragging && 'transition-transform duration-200 ease-out',
          mobileHeightClassName,
          desktopMaxWidth[desktopSize],
        )}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          className="touch-none pt-2 sm:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-text-muted/40" aria-hidden="true" />
        </div>
        <div className="shrink-0 border-b border-border p-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {onBack && (
                <button
                  type="button"
                  aria-label={backLabel}
                  onClick={onBack}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="18"
                    height="18"
                  >
                    <path d="M12.5 5 7.5 10 12.5 15" />
                  </svg>
                </button>
              )}
              {icon}
              <h1 className="truncate font-display text-xl">{title}</h1>
            </div>
            <button
              type="button"
              aria-label={closeLabel}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
              onClick={onClose}
            >
              <CloseIcon width={16} height={16} />
            </button>
          </div>
          {headerExtra}
        </div>
        {/* Keyed by title - swapping between an internal menu and a
            sub-view (see onBack above) remounts the body, replaying the
            fade-in-up entrance rather than jump-cutting between them. */}
        <div key={title} className={cn('fade-in-up', bodyClassName ?? 'scrollbar-hide min-h-0 flex-1 overflow-y-auto p-4')}>
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-border p-4 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

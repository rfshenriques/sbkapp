import { CloseIcon } from '../../components/ui/CloseIcon';
import { AT_LEAST_TABLET_DIMENSIONS_QUERY, DESKTOP_POINTER_QUERY } from '../../lib/deviceTier';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useScrollLock } from '../../lib/useScrollLock';
import { BetSlipPanel } from './BetSlipPanel';

export interface TabletBetSlipDrawerProps {
  onClose: () => void;
  closeLabel: string;
}

/**
 * Tablet (see AppShell) presentation of the bet slip: a touch/coarse-pointer
 * device - regardless of exact width or orientation, a landscape tablet can
 * easily exceed 1024px CSS width and get mistaken for a desktop browser
 * window by a pure width check - never gets the persistent desktop column
 * (that's real-mouse-and-hover devices only, see AppShell's isDesktopPointer),
 * but there's more room than a phone (checked via
 * AT_LEAST_TABLET_DIMENSIONS_QUERY, not a plain min-width - a phone in
 * landscape can itself exceed 640px CSS width and get mistaken for a
 * tablet by width alone), so instead of mobile's full-height bottom sheet
 * this floats over the content anchored to the right edge, opened/closed
 * via the same betSlipSheetStore the mobile sheet uses.
 *
 * Renders nothing outside that tier - not just CSS-hidden - rather than a
 * bare Tailwind class on the root: the mobile BottomSheet is mounted
 * (merely CSS-hidden) at every width whenever the sheet is open, and both
 * it and this drawer call useScrollLock, which isn't reentrant across two
 * simultaneously-mounted lockers touching the same body element - actually
 * mounting only one of them at a time avoids that entirely, on top of not
 * keeping a redundant off-screen BetSlipPanel instance around.
 */
export function TabletBetSlipDrawer({ onClose, closeLabel }: TabletBetSlipDrawerProps) {
  const isAtLeastTabletWidth = useMediaQuery(AT_LEAST_TABLET_DIMENSIONS_QUERY);
  const isDesktopPointer = useMediaQuery(DESKTOP_POINTER_QUERY);
  const isTabletTier = isAtLeastTabletWidth && !isDesktopPointer;
  useScrollLock(isTabletTier);

  if (!isTabletTier) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={closeLabel}
        className="backdrop-fade-in absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="sheet-slide-in-right absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-hidden border-l border-border bg-surface shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-4 pb-3">
          <h1 className="font-display text-xl">Bet Slip</h1>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>
        {/* No overflow-y-auto here - BetSlipPanel already manages its own
            scrollable selections region and fixed footer internally (same
            reason BottomSheet's bodyClassName is overridden the same way
            for the mobile bet slip sheet). */}
        <div className="fade-in-up min-h-0 flex-1 p-4">
          <BetSlipPanel showHistoryTab />
        </div>
      </div>
    </div>
  );
}

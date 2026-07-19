import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { ChevronIcon } from './ChevronIcon';

export interface BreadcrumbOption {
  key: string;
  label: string;
  href: string;
  /** Kickoff date/time (or nothing, for a live match) - same rule as MatchCard, right-aligned opposite the label. */
  meta?: ReactNode;
}

export interface BreadcrumbSegment {
  key: string;
  label: string;
  /** Plain link target - ignored once `options` has more than one entry (a dropdown takes over). */
  href?: string;
  /** When there's more than one, the segment becomes a dropdown letting the player jump straight to a sibling (another match in this competition, another league in this country, another country in this sport) instead of going back first. */
  options?: BreadcrumbOption[];
}

// Desktop's dropdown sits inline in a row with other segments, so its panel
// stays a fixed, narrower width rather than matching the trigger.
const PANEL_WIDTH_DESKTOP = 288;

/**
 * The trigger can live inside a horizontally-scrolling row, so the dropdown
 * panel can't be positioned relative to it (an `overflow-x` ancestor clips
 * `absolute` children on the cross axis too, and near the right edge on a
 * narrow phone it would run off-screen anyway). Instead the panel is
 * `position: fixed`, placed from the trigger's own bounding rect at open
 * time and clamped to stay within the viewport.
 */
function BreadcrumbDropdown({
  label,
  options,
  variant = 'inline',
}: {
  label: string;
  options: BreadcrumbOption[];
  variant?: 'inline' | 'pill';
}) {
  const [panel, setPanel] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const isOpen = panel !== null;

  function openPanel() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // The mobile pill is already full-width in its container, so match the
    // panel to it exactly rather than a fixed guess - that's what keeps
    // every row's date/time flush to the same right edge as the trigger's.
    const width = variant === 'pill' ? rect.width : PANEL_WIDTH_DESKTOP;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPanel({ top: rect.bottom + 6, left, width });
  }

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setPanel(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPanel(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => (isOpen ? setPanel(null) : openPanel())}
        className={cn(
          'flex items-center gap-1.5 font-semibold text-text-primary hover:text-highlight',
          variant === 'pill'
            ? 'w-full justify-between rounded-xl bg-surface-2 px-3 py-2 text-left text-sm'
            : 'whitespace-nowrap',
        )}
      >
        <span className={cn('min-w-0 flex-1', variant === 'pill' ? 'whitespace-normal break-words' : 'whitespace-nowrap')}>
          {label}
        </span>
        <ChevronIcon className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {panel && (
        <ul
          ref={panelRef}
          role="listbox"
          style={{ top: panel.top, left: panel.left, width: panel.width }}
          className="scrollbar-hide fixed z-30 max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.key}>
              <Link
                to={option.href}
                role="option"
                aria-selected={option.label === label}
                onClick={() => setPanel(null)}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5',
                  option.label === label ? 'text-highlight' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <span className="!whitespace-normal break-words">{option.label}</span>
                {option.meta && <span className="shrink-0 text-xs font-bold text-text-muted">{option.meta}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Each segment either links straight through (Home, Sport) or - when it has
 * more than one option - becomes a dropdown so the player can jump to a
 * sibling directly instead of navigating back first. See CLAUDE.md: only
 * ever built from real match data, never a fabricated hierarchy.
 *
 * Two layouts, swapped by breakpoint (not JS media queries, matching this
 * codebase's existing sm: convention):
 *
 * - Desktop (sm+): one row, every actionable segment its own inline
 *   dropdown, read left-to-right starting at Home like a normal breadcrumb.
 *   `overflow-x-auto` is only a safety net for a viewport too narrow to fit
 *   it all - it stays scrolled to the start (Home first) rather than
 *   jumping anywhere, since desktop usually has the room to show everything.
 * - Mobile: cramming Home / Sport / Country / Competition / Match onto one
 *   line made every segment an unreadable sliver. Instead the ancestors
 *   (everything but the last segment, and dropping the "Home" crumb - the
 *   `icon` and a back button already say "you can leave this page") sit on
 *   their own plain, non-dropdown trail line, and only the final segment -
 *   the one thing worth switching on a phone - gets its own full-width
 *   pill-shaped dropdown button below, with its full label (and every
 *   option's full label) always shown in full - wrapping instead of
 *   ellipsis-truncating, since a half-cut team or match name isn't useful
 *   to a player picking between them.
 */
export function Breadcrumb({ segments, icon }: { segments: BreadcrumbSegment[]; icon?: ReactNode }) {
  const trailSegments = segments.slice(0, -1);
  const mobileTrailSegments = trailSegments.filter((segment) => segment.key !== 'home');
  const activeSegment = segments[segments.length - 1];
  const scrollableRowClassName = 'scrollbar-hide flex min-w-0 items-center gap-1.5 overflow-x-auto';

  return (
    <div className="min-w-0">
      <div data-testid="breadcrumb-mobile" className="sm:hidden">
        {(icon || mobileTrailSegments.length > 0) && (
          <nav
            aria-label="Breadcrumb trail"
            className={cn(scrollableRowClassName, 'text-xs text-text-muted')}
          >
            {icon && <span className="flex shrink-0 items-center gap-1">{icon}</span>}
            {mobileTrailSegments.map((segment, index) => (
              <span key={segment.key} className="flex shrink-0 items-center gap-1.5">
                {index > 0 && (
                  <ChevronIcon aria-hidden="true" className="h-3 w-3 shrink-0 -rotate-90 text-text-muted" />
                )}
                {segment.href ? (
                  <Link to={segment.href} className="whitespace-nowrap hover:text-text-primary">
                    {segment.label}
                  </Link>
                ) : (
                  <span className="whitespace-nowrap">{segment.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {activeSegment && (
          <div className="mt-1.5">
            {activeSegment.options && activeSegment.options.length > 1 ? (
              <BreadcrumbDropdown label={activeSegment.label} options={activeSegment.options} variant="pill" />
            ) : activeSegment.href ? (
              <Link
                to={activeSegment.href}
                className="block rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold text-text-primary"
              >
                {activeSegment.label}
              </Link>
            ) : (
              <span className="block rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold text-text-primary">
                {activeSegment.label}
              </span>
            )}
          </div>
        )}
      </div>

      <nav
        data-testid="breadcrumb-desktop"
        aria-label="Breadcrumb"
        className={cn('hidden text-sm sm:flex', scrollableRowClassName)}
      >
        {icon && <span className="flex shrink-0 items-center gap-1">{icon}</span>}
        {segments.map((segment, index) => (
          <span key={segment.key} className="flex shrink-0 items-center gap-1.5">
            {index > 0 && (
              <ChevronIcon aria-hidden="true" className="h-3 w-3 shrink-0 -rotate-90 text-text-muted" />
            )}
            {segment.options && segment.options.length > 1 ? (
              <BreadcrumbDropdown label={segment.label} options={segment.options} />
            ) : segment.href ? (
              <Link to={segment.href} className="whitespace-nowrap text-text-muted hover:text-text-primary">
                {segment.label}
              </Link>
            ) : (
              <span className="whitespace-nowrap font-semibold text-text-primary">{segment.label}</span>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { ChevronIcon } from './ChevronIcon';

export interface BreadcrumbOption {
  key: string;
  label: string;
  href: string;
}

export interface BreadcrumbSegment {
  key: string;
  label: string;
  /** Plain link target - ignored once `options` has more than one entry (a dropdown takes over). */
  href?: string;
  /** When there's more than one, the segment becomes a dropdown letting the player jump straight to a sibling (another match in this competition, another league in this country, another country in this sport) instead of going back first. */
  options?: BreadcrumbOption[];
}

const PANEL_WIDTH = 224; // w-56

/**
 * The trigger lives inside the breadcrumb's horizontally-scrolling row, so
 * the dropdown panel can't be positioned relative to it (an `overflow-x`
 * ancestor clips `absolute` children on the cross axis too, and near the
 * right edge on a narrow phone it would run off-screen anyway). Instead the
 * panel is `position: fixed`, placed from the trigger's own bounding rect at
 * open time and clamped to stay within the viewport - that escapes the
 * scroll container's clipping entirely and never overflows the screen edge.
 */
function BreadcrumbDropdown({ label, options }: { label: string; options: BreadcrumbOption[] }) {
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const isOpen = panelPosition !== null;

  function openPanel() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8);
    setPanelPosition({ top: rect.bottom + 6, left });
  }

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setPanelPosition(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPanelPosition(null);
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
        onClick={() => (isOpen ? setPanelPosition(null) : openPanel())}
        className="flex items-center gap-1 font-semibold text-text-primary hover:text-highlight"
      >
        <span className="whitespace-nowrap">{label}</span>
        <ChevronIcon className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {panelPosition && (
        <ul
          ref={panelRef}
          role="listbox"
          style={{ top: panelPosition.top, left: panelPosition.left, width: PANEL_WIDTH }}
          className="fixed z-30 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.key}>
              <Link
                to={option.href}
                role="option"
                aria-selected={option.label === label}
                onClick={() => setPanelPosition(null)}
                className={cn(
                  'block truncate px-3 py-2 text-sm transition-colors hover:bg-white/5',
                  option.label === label ? 'text-highlight' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {option.label}
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
 * On narrow screens the full trail (Home / Sport / Country / Competition /
 * Match) rarely fits - squeezing every segment to fit the width just made
 * each one an unreadable sliver. Instead each segment keeps its natural
 * size and the row scrolls horizontally, auto-scrolled to the end on
 * mount/segment-change so the current (rightmost, most actionable) crumb
 * is what's visible by default; older ancestors are a swipe away.
 */
export function Breadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  const scrollRef = useRef<HTMLElement>(null);
  const lastKey = segments[segments.length - 1]?.key;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [lastKey]);

  return (
    <nav
      ref={scrollRef}
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 overflow-x-auto text-xs [-ms-overflow-style:none] [scrollbar-width:none] sm:text-sm [&::-webkit-scrollbar]:hidden"
    >
      {segments.map((segment, index) => (
        <span key={segment.key} className="flex shrink-0 items-center gap-1.5">
          {index > 0 && (
            <ChevronIcon
              aria-hidden="true"
              className="h-3 w-3 shrink-0 -rotate-90 text-text-muted"
            />
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
  );
}

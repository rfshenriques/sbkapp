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

function BreadcrumbDropdown({ label, options }: { label: string; options: BreadcrumbOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1 font-semibold text-text-primary hover:text-highlight"
      >
        <span className="max-w-[10rem] truncate sm:max-w-none">{label}</span>
        <ChevronIcon className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-20 mt-1.5 max-h-72 w-56 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.key}>
              <Link
                to={option.href}
                role="option"
                aria-selected={option.label === label}
                onClick={() => setIsOpen(false)}
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
    </div>
  );
}

/**
 * Each segment either links straight through (Home, Sport) or - when it has
 * more than one option - becomes a dropdown so the player can jump to a
 * sibling directly instead of navigating back first. See CLAUDE.md: only
 * ever built from real match data, never a fabricated hierarchy.
 */
export function Breadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs sm:text-sm">
      {segments.map((segment, index) => (
        <span key={segment.key} className="flex min-w-0 items-center gap-1.5">
          {index > 0 && (
            <ChevronIcon
              aria-hidden="true"
              className="h-3 w-3 shrink-0 -rotate-90 text-text-muted"
            />
          )}
          {segment.options && segment.options.length > 1 ? (
            <BreadcrumbDropdown label={segment.label} options={segment.options} />
          ) : segment.href ? (
            <Link to={segment.href} className="truncate text-text-muted hover:text-text-primary">
              {segment.label}
            </Link>
          ) : (
            <span className="truncate font-semibold text-text-primary">{segment.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

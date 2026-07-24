import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title: string;
  description: string;
  ctaLabel: string;
  /** Navigates to a route - mutually exclusive with onCtaClick (e.g. opening the auth modal in place, without navigating away). */
  ctaHref?: string;
  onCtaClick?: () => void;
  /** e.g. a bet-placed confirmation shown above the title - owned by the caller, not this component. */
  above?: ReactNode;
}

/** Shared "nothing here yet" layout for panels that are never just blank - the bet slip and bet history both nudge toward the same next action (browse matches / log in) instead of sitting empty. */
export function EmptyState({ title, description, ctaLabel, ctaHref, onCtaClick, above }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
      {above}
      <p className="font-display text-lg">{title}</p>
      <p className="max-w-[220px] text-sm text-text-secondary">{description}</p>
      {onCtaClick ? (
        <button type="button" onClick={onCtaClick} className="btn-primary">
          {ctaLabel}
        </button>
      ) : (
        <Link to={ctaHref ?? '/'} className="btn-primary">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

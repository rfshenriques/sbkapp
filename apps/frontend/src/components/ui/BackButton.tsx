import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn';

interface BackButtonProps {
  className?: string;
}

/** Returns to wherever the player came from (browser history), not a fixed route - used on drill-down pages (leagues, matches) reached from a list. */
export function BackButton({ className }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => navigate(-1)}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary',
        className,
      )}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M12.5 5 7.5 10 12.5 15" />
      </svg>
    </button>
  );
}

import { cn } from '../../lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  id?: string;
}

/**
 * iOS-style toggle - the fully-rounded pill/thumb shape this project's
 * status pills already use. Uses --color-highlight for the on-state, same
 * as every other selected/active accent (odd-btn.selected, active tabs),
 * not --color-brand which is reserved for CTAs.
 */
export function Switch({ checked, onChange, ariaLabel, id }: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-highlight' : 'bg-border',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}

import { cn } from '../../lib/cn';

interface SunMoonToggleProps {
  /** true = dark (moon), false = light (sun). */
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  id?: string;
}

/**
 * Same iOS-style pill/thumb shape as Switch, but the thumb itself morphs
 * between a sun and a moon glyph (cross-faded by opacity, not swapped
 * components, so the slide reads as one continuous transition) rather than
 * being a plain dot - the track tints warm/day on light and cool/night on
 * dark to sell the metaphor further.
 */
export function SunMoonToggle({ checked, onChange, ariaLabel, id }: SunMoonToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300',
        checked ? 'bg-[#1E2340]' : 'bg-[#7EC8F0]',
      )}
    >
      <span
        className={cn(
          'absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform duration-300',
          checked && 'translate-x-6',
        )}
      >
        {/* Sun - full opacity in light mode, fades out under the moon in dark mode. */}
        <svg
          viewBox="0 0 20 20"
          className={cn('absolute h-4 w-4 text-[#F5A623] transition-opacity duration-300', checked && 'opacity-0')}
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="4" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4M15.8 15.8l-1.4-1.4M5.6 5.6 4.2 4.2" />
          </g>
        </svg>
        {/* Moon - full opacity in dark mode. */}
        <svg
          viewBox="0 0 20 20"
          className={cn('absolute h-4 w-4 text-[#3B3F6B] opacity-0 transition-opacity duration-300', checked && 'opacity-100')}
          aria-hidden="true"
        >
          <path d="M15.5 12.8A6.5 6.5 0 0 1 7.2 4.5a6.5 6.5 0 1 0 8.3 8.3Z" fill="currentColor" />
        </svg>
      </span>
    </button>
  );
}

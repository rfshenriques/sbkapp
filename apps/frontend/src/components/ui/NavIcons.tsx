import type { SVGProps } from 'react';
import { useContrastColor } from '../../lib/useContrastColor';

/**
 * Bottom-nav icons as small inline SVGs (not emoji) so they can be
 * recolored via `currentColor` to match the active/inactive text color of
 * their NavLink, same as the label next to them.
 */
type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <line x1="16.5" y1="16.5" x2="12.6" y2="12.6" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 9.5 10 3l7 6.5" />
      <path d="M5 8.5V17h10V8.5" />
    </svg>
  );
}

export function LiveIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="10" cy="10" r="2" fill="currentColor" stroke="none" />
      <path d="M6.2 6.2a5.4 5.4 0 0 0 0 7.6" />
      <path d="M13.8 6.2a5.4 5.4 0 0 1 0 7.6" />
      <path d="M3.5 3.5a9.6 9.6 0 0 0 0 13" />
      <path d="M16.5 3.5a9.6 9.6 0 0 1 0 13" />
    </svg>
  );
}

export function MyBetsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 3h10a1 1 0 0 1 1 1v12l-2.5-1.5L11 16l-2.5-1.5L6 16l-2.5-1.5L4 16V4a1 1 0 0 1 1-1Z" />
      <line x1="6.5" y1="6.5" x2="13.5" y2="6.5" />
      <line x1="6.5" y1="9.5" x2="13.5" y2="9.5" />
    </svg>
  );
}

export function BoostIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M11 2.5 4.5 11h4l-1 6.5L15.5 9h-4l-0.5-6.5Z" />
    </svg>
  );
}

export function SpecialsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 2.8 12 7.4l5 0.6-3.7 3.4 1 4.9L10 13.9l-4.3 2.4 1-4.9L3 8l5-0.6Z" />
    </svg>
  );
}

export function PromotionsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3.5" y="8" width="13" height="9" rx="1" />
      <path d="M3.5 11.5h13" />
      <path d="M10 8v9" />
      <path d="M10 8C8.5 8 7 7.3 7 5.8A1.8 1.8 0 0 1 8.8 4C9.8 4 10 5.5 10 8Z" />
      <path d="M10 8c1.5 0 3-.7 3-2.2A1.8 1.8 0 0 0 11.2 4C10.2 4 10 5.5 10 8Z" />
    </svg>
  );
}

/** Cash balance - a simple wallet, distinct from the ticket used for freebets. */
export function WalletIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="2.5" y="5.5" width="15" height="10" rx="1.5" />
      <path d="M2.5 8.5h15" />
      <circle cx="13.5" cy="11.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Freebets balance - a solid circular badge with a bold "F", distinct from
 * the plain-stroke wallet icon used for cash. Unlike the other icons here
 * it's filled, not stroke-only, and always fills with --color-highlight
 * directly (this is a general accent/status indicator, not a CTA, so it
 * never uses --color-brand) rather than taking a color via `currentColor` -
 * that lets it also pick the ring/letter's own color (see useContrastColor)
 * to match, since a brand can set --color-highlight to something light
 * enough that a fixed white ring/letter would disappear into it.
 */
export function FreebetBadgeIcon(props: IconProps) {
  const contrast = useContrastColor('--color-highlight');
  return (
    <svg viewBox="0 0 20 20" {...props}>
      <circle cx="10" cy="10" r="9" fill="var(--color-highlight)" />
      <circle cx="10" cy="10" r="9" fill="none" stroke={contrast} strokeWidth="1.3" />
      <text x="10" y="14" textAnchor="middle" fontSize="10.5" fontWeight="800" fill={contrast}>
        F
      </text>
    </svg>
  );
}

/** Still-resolving/OPEN status - a clock face, next to the check/cross used for WON/LOST. */
export function ClockIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4l3 2" />
    </svg>
  );
}

/** Signed-in player's account menu trigger - a head-and-shoulders silhouette, replacing the old plain "Log out" button. */
export function AccountIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.5 17c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" />
    </svg>
  );
}

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

/** Highlights tab - the homepage of standout/live matches, a flame rather than a house. */
export function FireIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 2.5c2.2 2.8 4.5 5.6 4.5 8.7a4.5 4.5 0 0 1-9 0c0-1.3.4-2.4 1-3.4.1 1.3.9 2.1 1.8 2.1.9 0 1.3-.7 1.1-1.7-.3-1.6.2-3.6 1.6-5.7Z" />
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

/**
 * Challenges tab - a trophy, solid-filled like FreebetBadgeIcon rather than
 * stroke-only like its baseProps siblings, so it reads clearly as a small
 * accent both in the nav strip and as the corner badge on a challenge card
 * (see PromoCardTile). Color comes from `currentColor`/className, not a
 * fixed fill, so it still follows the nav's active/inactive text color.
 */
export function TrophyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M6 3h8v4.5a4 4 0 0 1-8 0V3Z" />
      <path
        d="M6 4.5H4a2 2 0 0 0 2 3.3M14 4.5h2a2 2 0 0 1-2 3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M9.2 10.8h1.6v2.4H9.2z" />
      <path d="M7 15.6h6l-.6-1.7H7.6l-.6 1.7Z" />
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
      <text
        x="10"
        y="14"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="800"
        fontStyle="italic"
        fill={contrast}
      >
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

/** Share action (BetPlacedModal) - an upward arrow out of a tray, the standard share glyph. */
export function ShareIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 12.5V4" />
      <path d="M6.8 7.2 10 4l3.2 3.2" />
      <path d="M4.5 11v4a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

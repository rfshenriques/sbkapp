import type { SVGProps } from 'react';

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
 * Freebets balance - a solid circular badge with a bold italic "F", distinct
 * from the plain-stroke wallet icon used for cash. Unlike the other icons
 * here it's filled, not stroke-only, and fills with --color-brand directly
 * (an explicit, deliberate exception to the brand-color-is-CTA-only
 * convention elsewhere in this codebase - chosen after comparing options
 * directly) rather than taking a color via `currentColor`. Ring/letter are
 * fixed white rather than auto-picked per-brand contrast, same reasoning.
 */
export function FreebetBadgeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" {...props}>
      <circle cx="10" cy="10" r="9" fill="var(--color-brand)" />
      <circle cx="10" cy="10" r="9" fill="none" stroke="white" strokeWidth="1.3" />
      <text x="10" y="14" textAnchor="middle" fontSize="10.5" fontWeight="800" fontStyle="italic" fill="white">
        F
      </text>
    </svg>
  );
}

/**
 * Notification-dot badge for "there's a reward available here" - the
 * collapsed mobile bet slip pill (campaign qualification) and the header's
 * cash balance pill (an eligible deposit campaign) both use this exact mark
 * in their top-right corner. Fixed --color-price-up green (the app's
 * existing non-brand "success" token, see betStatus.ts) and a plain gift
 * box glyph rather than the freebet "F" badge - this points at a reward in
 * general, not specifically a freebet balance.
 */
export function GiftBadgeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="11" fill="var(--color-price-up)" />
      <g stroke="black" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6.5" y="10.5" width="11" height="8" rx="0.8" />
        <path d="M6.5 13.5h11" />
        <path d="M12 10.5v8" />
        <path d="M12 10.5c-1-2-2.2-2.8-3.2-2.8-1 0-1.8.7-1.8 1.6s.8 1.2 1.8 1.2c1 0 2.2-.4 3.2-1z" />
        <path d="M12 10.5c1-2 2.2-2.8 3.2-2.8 1 0 1.8.7 1.8 1.6s-.8 1.2-1.8 1.2c-1 0-2.2-.4-3.2-1z" />
      </g>
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

/** Copy-link action, next to Share on an open bet (see SharePendingBetActions) - two overlapping rounded rectangles, the standard "copy" glyph. */
export function CopyIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.8" />
      <path d="M12.5 7.5V5.8A1.8 1.8 0 0 0 10.7 4H5.8A1.8 1.8 0 0 0 4 5.8v4.9a1.8 1.8 0 0 0 1.8 1.8h1.7" />
    </svg>
  );
}

/** "See everything, unfiltered" - All matches, Browse matches - a plain 2x2 grid rather than any one sport's glyph. */
export function GridIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1.2" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" />
    </svg>
  );
}

/** A generic odds market section (Match Result and every other market on the match page) - three uneven bars standing in for a row of odds buttons. */
export function MarketIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="2.5" y="7" width="4.2" height="9" rx="1.4" />
      <rect x="7.9" y="4" width="4.2" height="12" rx="1.4" />
      <rect x="13.3" y="9" width="4.2" height="7" rx="1.4" />
    </svg>
  );
}

/** Upcoming - a calendar, next to LiveIcon's already-happening broadcast rings. */
export function CalendarIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4.5" width="14" height="12" rx="1.8" />
      <path d="M3 8h14" />
      <path d="M6.5 2.8v3" />
      <path d="M13.5 2.8v3" />
    </svg>
  );
}

/** Responsible Gambling - a shield with a checkmark. */
export function ShieldIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 2.5 16 5v5c0 4-2.6 6.7-6 7.5-3.4-.8-6-3.5-6-7.5V5l6-2.5Z" />
      <path d="M7.3 10 9.2 11.8 12.8 8" />
    </svg>
  );
}

/** ErrorPage - a warning triangle, next to CompassIcon's "where am I" for NotFoundPage. */
export function WarningIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 3 18 16H2L10 3Z" />
      <line x1="10" y1="8" x2="10" y2="11.5" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** NotFoundPage - a compass, "you've wandered off the map". */
export function CompassIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M13 7 11.2 11.2 7 13 8.8 8.8 13 7Z" />
    </svg>
  );
}

/** Register modal - AccountIcon's silhouette plus a "+", distinct from the plain login silhouette. */
export function AccountPlusIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="8.2" cy="7" r="3" />
      <path d="M2.5 17c0-3.1 2.6-5.6 5.7-5.6" />
      <path d="M15 8v5.5" />
      <path d="M12.3 10.8h5.4" />
    </svg>
  );
}

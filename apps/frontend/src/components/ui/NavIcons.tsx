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

import type { SVGProps } from 'react';

/**
 * Bespoke icons for LiveMatchTracker's Key Events feed, replacing the
 * generic emoji/refresh-icon placeholders. Cards use their real-world
 * colors (yellow/red) as the actual signal, same as --color-danger is
 * already used as a fixed, brand-independent red elsewhere - a card's
 * color isn't a brand accent, it's the event itself. Goal and
 * substitution stay monochrome (currentColor), matching NavIcons'
 * line-icon language, since they carry no inherent color of their own.
 */
type IconProps = SVGProps<SVGSVGElement>;

const YELLOW_CARD = '#f5c518';

const lineProps = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** A simplified soccer ball - outer circle plus a pentagon facet, the universal shorthand for "goal" regardless of sport-specific detail (own goal, penalty, ...). */
export function GoalIcon(props: IconProps) {
  return (
    <svg {...lineProps} {...props}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 5.6 13.7 8.3l-1.4 4.4H7.7l-1.4-4.4Z" />
      <path d="M10 5.6V2.75M13.7 8.3l2.7-1.9M12.3 12.7l1.7 2.6M7.7 12.7l-1.7 2.6M6.3 8.3l-2.7-1.9" />
    </svg>
  );
}

function card(props: IconProps, fill: string) {
  return (
    <svg viewBox="0 0 20 20" {...props}>
      <rect x="5.5" y="2.5" width="9" height="13" rx="1.6" fill={fill} transform="rotate(8 10 9)" />
    </svg>
  );
}

export function YellowCardIcon(props: IconProps) {
  return card(props, YELLOW_CARD);
}

export function RedCardIcon(props: IconProps) {
  return card(props, 'var(--color-danger)');
}

/** Two arrows - one in, one out - the shorthand every sports app uses for a substitution, clearer at a glance than a generic circular-refresh icon. */
export function SubstitutionIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <g stroke="#22c55e">
        <path d="M6.5 14.5V4.5" />
        <path d="M3.8 7.2 6.5 4.5l2.7 2.7" />
      </g>
      <g stroke="var(--color-danger)">
        <path d="M13.5 5.5v10" />
        <path d="M16.2 12.8 13.5 15.5l-2.7-2.7" />
      </g>
    </svg>
  );
}

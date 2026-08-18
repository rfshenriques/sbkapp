import type { SVGProps } from 'react';

/** A boosted odd's corner badge glyph (see MarketSelections/BoostedOddsRow) - decorative only, the button's own aria-label already spells out the boost. */
export function BoostIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10 15.5V5.5" />
      <path d="M5.5 10 10 5.5 14.5 10" />
    </svg>
  );
}

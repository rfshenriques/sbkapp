import type { SVGProps } from 'react';

/** Points down by default; pass `className="rotate-180"` for the expanded (pointing up) state. */
export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}

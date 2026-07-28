import type { SVGProps } from 'react';

/** Stacked up/down arrows - marks the Time/Relevance order toggle as a sort control. */
export function SortIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M6 15V5" />
      <path d="M3.5 8 6 5 8.5 8" />
      <path d="M14 5V15" />
      <path d="M11.5 12 14 15 16.5 12" />
    </svg>
  );
}

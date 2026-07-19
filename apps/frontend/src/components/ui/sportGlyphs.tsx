import type { ReactElement } from 'react';

/**
 * Hand-drawn full-bleed circular fallback artwork, only for sports with no
 * matching image in assets/sport-icons (see SportIcon.tsx) - Ice Hockey
 * today, plus a generic fallback for anything unmapped.
 */
function IceHockey() {
  return (
    <>
      <circle cx="16" cy="16" r="16" fill="#1B2A4A" />
      <rect x="8" y="7" width="3.4" height="19" rx="1.2" fill="#ffffff" transform="rotate(24 16 16)" />
      <ellipse cx="22.5" cy="23.5" rx="4.2" ry="2.1" fill="#0a0a0a" />
    </>
  );
}

function Fallback() {
  return (
    <>
      <circle cx="16" cy="16" r="16" fill="#3a4150" />
      <path d="M16 8l2.2 4.6 5 .7-3.6 3.6.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.6 5-.7z" fill="#c9ccd3" />
    </>
  );
}

const SPORT_GLYPH: Record<string, () => ReactElement> = {
  'Ice Hockey': IceHockey,
};

export function SportGlyph({ sport }: { sport: string }) {
  const Glyph = SPORT_GLYPH[sport] ?? Fallback;
  return <Glyph />;
}

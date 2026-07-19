import type { ReactElement } from 'react';

/**
 * Football, Tennis, and Basketball use the real platform sport emoji
 * instead of hand-drawn artwork (see SportIcon.tsx) - their emoji are
 * already a filled circle/ball, so they read better than a redrawn
 * approximation. Everything below is for the remaining sports, whose emoji
 * (a hockey stick, a football, a boxing glove) aren't circular, so they get
 * hand-drawn full-bleed circular artwork in the same visual style instead.
 */
export const ROUND_SPORT_EMOJI: Record<string, string> = {
  Football: '⚽',
  Tennis: '🎾',
  Basketball: '🏀',
};

function IceHockey() {
  return (
    <>
      <circle cx="16" cy="16" r="16" fill="#1B2A4A" />
      <rect x="8" y="7" width="3.4" height="19" rx="1.2" fill="#ffffff" transform="rotate(24 16 16)" />
      <ellipse cx="22.5" cy="23.5" rx="4.2" ry="2.1" fill="#0a0a0a" />
    </>
  );
}

function AmericanFootball() {
  return (
    <>
      <circle cx="16" cy="16" r="16" fill="#6B3E1E" />
      <g transform="rotate(-25 16 16)">
        <ellipse cx="16" cy="16" rx="10.5" ry="6" fill="#9a5a2c" stroke="#ffffff" strokeWidth="1" />
        <line x1="11" y1="16" x2="21" y2="16" stroke="#ffffff" strokeWidth="1" />
        <line x1="13.5" y1="14" x2="13.5" y2="18" stroke="#ffffff" strokeWidth="1" />
        <line x1="16" y1="14" x2="16" y2="18" stroke="#ffffff" strokeWidth="1" />
        <line x1="18.5" y1="14" x2="18.5" y2="18" stroke="#ffffff" strokeWidth="1" />
      </g>
    </>
  );
}

function MMA() {
  return (
    <>
      <circle cx="16" cy="16" r="16" fill="#2b2f3a" />
      <rect x="9" y="13" width="14" height="10" rx="3" fill="#e8e8ec" />
      <rect x="12" y="8.5" width="3" height="6.5" rx="1.4" fill="#e8e8ec" />
      <rect x="16" y="7.5" width="3" height="7.5" rx="1.4" fill="#e8e8ec" />
      <rect x="20" y="8.5" width="3" height="6.5" rx="1.4" fill="#e8e8ec" />
    </>
  );
}

function Boxing() {
  return (
    <>
      <circle cx="16" cy="16" r="16" fill="#8B1E1E" />
      <path
        d="M10 14c0-3 2-5 5-5h2c3 0 5 2 5 5v6c0 2.5-1.5 4.5-3.5 5l-4 3.5-2-2 2-2.5c-1-1-1.5-2-1.5-3v-7z"
        fill="#f4f4f4"
      />
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
  'American Football': AmericanFootball,
  MMA,
  Boxing,
};

export function SportGlyph({ sport }: { sport: string }) {
  const Glyph = SPORT_GLYPH[sport] ?? Fallback;
  return <Glyph />;
}

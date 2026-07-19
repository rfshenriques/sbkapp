import type { ReactElement } from 'react';

/**
 * Full-bleed circular flag artwork (not emoji) - each glyph fills the
 * entire 32x32 viewBox; the wrapping <span> in CountryFlag clips it to a
 * circle via CSS (rounded-full + overflow-hidden), matching the reference
 * mockup's solid circular flag icons rather than a small emoji floating in
 * a padded gray badge.
 *
 * Simplified renditions (stripes/cross only, no coats of arms/stars) -
 * accurate enough to read correctly at a glance in a nav row, not intended
 * as precise heraldry. The "World"/"International" groupings and any
 * unmapped country get a neutral globe rather than a fabricated flag.
 */
function England() {
  return (
    <>
      <rect width="32" height="32" fill="#ffffff" />
      <rect x="13" width="6" height="32" fill="#CE1124" />
      <rect y="13" width="32" height="6" fill="#CE1124" />
    </>
  );
}

function Spain() {
  return (
    <>
      <rect width="32" height="32" fill="#AA151B" />
      <rect y="8" width="32" height="16" fill="#F1BF00" />
    </>
  );
}

function Germany() {
  return (
    <>
      <rect width="32" height="32" fill="#000000" />
      <rect y="10.67" width="32" height="21.33" fill="#DD0000" />
      <rect y="21.33" width="32" height="10.67" fill="#FFCE00" />
    </>
  );
}

function Italy() {
  return (
    <>
      <rect width="32" height="32" fill="#ffffff" />
      <rect width="10.67" height="32" fill="#009246" />
      <rect x="21.33" width="10.67" height="32" fill="#CE2B37" />
    </>
  );
}

function France() {
  return (
    <>
      <rect width="32" height="32" fill="#ffffff" />
      <rect width="10.67" height="32" fill="#0055A4" />
      <rect x="21.33" width="10.67" height="32" fill="#EF4135" />
    </>
  );
}

function Netherlands() {
  return (
    <>
      <rect width="32" height="32" fill="#ffffff" />
      <rect width="32" height="10.67" fill="#AE1C28" />
      <rect y="21.33" width="32" height="10.67" fill="#21468B" />
    </>
  );
}

const EU_STAR_POSITIONS: Array<[number, number]> = [
  [26, 16],
  [23.07, 23.07],
  [16, 26],
  [8.93, 23.07],
  [6, 16],
  [8.93, 8.93],
  [16, 6],
  [23.07, 8.93],
];

function Europe() {
  return (
    <>
      <rect width="32" height="32" fill="#003399" />
      {EU_STAR_POSITIONS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="#FFCC00" />
      ))}
    </>
  );
}

function USA() {
  return (
    <>
      <rect width="32" height="32" fill="#B22234" />
      <rect y="4.57" width="32" height="4.57" fill="#ffffff" />
      <rect y="13.71" width="32" height="4.57" fill="#ffffff" />
      <rect y="22.86" width="32" height="4.57" fill="#ffffff" />
      <rect width="14" height="16" fill="#3C3B6E" />
      <circle cx="5" cy="5" r="1" fill="#ffffff" />
      <circle cx="10" cy="5" r="1" fill="#ffffff" />
      <circle cx="7.5" cy="8.5" r="1" fill="#ffffff" />
      <circle cx="5" cy="12" r="1" fill="#ffffff" />
      <circle cx="10" cy="12" r="1" fill="#ffffff" />
    </>
  );
}

const FLAG_GLYPH: Record<string, () => ReactElement> = {
  England,
  Spain,
  Germany,
  Italy,
  France,
  Netherlands,
  Europe,
  USA,
};

/** True for every country with real drawn flag artwork - CountryFlag.tsx renders the 🌍 globe emoji instead when this is false (World/International/anything unmapped). */
export function hasFlagGlyph(country: string): boolean {
  return country in FLAG_GLYPH;
}

export function FlagGlyph({ country }: { country: string }) {
  const Glyph = FLAG_GLYPH[country];
  return Glyph ? <Glyph /> : null;
}

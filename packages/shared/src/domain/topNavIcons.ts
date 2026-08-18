/**
 * A fixed, curated icon set for the player app's second navbar (see
 * apps/frontend's SecondaryNavBar and apps/backoffice's CMS Top nav page) -
 * staff pick one per entry rather than typing a text label, since the bar
 * itself is icon-only. Geometry lives here (not duplicated per-app) so
 * "a suite of icons all with the same type of design" is actually
 * guaranteed rather than two independently hand-drawn sets drifting apart -
 * each app's own thin SVG-rendering component just maps these shapes onto
 * an <svg>, matching the existing NavIcons.tsx convention: 20x20 viewBox,
 * strokeWidth 1.6, round caps/joins, currentColor so it inherits whatever
 * color context it's placed in.
 *
 * Keep TOP_NAV_ICON_KEYS in the exact order icons should appear in the CMS
 * picker. Whichever Prisma enum value list represents this on the backend
 * (see TopNavItem.icon in schema.prisma) must stay in sync with this list
 * by hand - Prisma enums can't import from a TS module.
 */
export type TopNavIconKey =
  | 'STAR'
  | 'FIRE'
  | 'TROPHY'
  | 'FLAG'
  | 'CALENDAR'
  | 'CLOCK'
  | 'BALL'
  | 'BELL'
  | 'BOLT'
  | 'TARGET'
  | 'GLOBE'
  | 'MEDAL'
  | 'CHART'
  | 'HEART'
  | 'GRID'
  | 'COMPASS';

export const TOP_NAV_ICON_KEYS: TopNavIconKey[] = [
  'STAR',
  'FIRE',
  'TROPHY',
  'FLAG',
  'CALENDAR',
  'CLOCK',
  'BALL',
  'BELL',
  'BOLT',
  'TARGET',
  'GLOBE',
  'MEDAL',
  'CHART',
  'HEART',
  'GRID',
  'COMPASS',
];

/** Every shape defaults to outline (stroke only) unless fill: 'currentColor' is set - matching NavIcons.tsx's existing mostly-outline style, with a filled shape only where it reads better solid (a bolt, a heart, a center dot). */
export type TopNavIconShape =
  | { kind: 'path'; d: string; fill?: 'currentColor' }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: 'currentColor' }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: 'currentColor' }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number };

export const TOP_NAV_ICON_LABELS: Record<TopNavIconKey, string> = {
  STAR: 'Star',
  FIRE: 'Fire',
  TROPHY: 'Trophy',
  FLAG: 'Flag',
  CALENDAR: 'Calendar',
  CLOCK: 'Clock',
  BALL: 'Ball',
  BELL: 'Bell',
  BOLT: 'Bolt',
  TARGET: 'Target',
  GLOBE: 'Globe',
  MEDAL: 'Medal',
  CHART: 'Chart',
  HEART: 'Heart',
  GRID: 'Grid',
  COMPASS: 'Compass',
};

export const TOP_NAV_ICON_SHAPES: Record<TopNavIconKey, TopNavIconShape[]> = {
  STAR: [
    {
      kind: 'path',
      d: 'M10 2 11.94 7.33 17.61 7.53 13.14 11.02 14.7 16.47 10 13.3 5.3 16.47 6.86 11.02 2.39 7.53 8.06 7.33Z',
    },
  ],
  FIRE: [
    {
      kind: 'path',
      d: 'M10 2.5c2.2 2.8 4.5 5.6 4.5 8.7a4.5 4.5 0 0 1-9 0c0-1.3.4-2.4 1-3.4.1 1.3.9 2.1 1.8 2.1.9 0 1.3-.7 1.1-1.7-.3-1.6.2-3.6 1.6-5.7Z',
    },
  ],
  TROPHY: [
    { kind: 'path', d: 'M6 3h8v4a4 4 0 0 1-8 0V3Z' },
    { kind: 'path', d: 'M6 4.5H4.5a1.8 1.8 0 0 0 1.8 3M14 4.5h1.5a1.8 1.8 0 0 1-1.8 3' },
    { kind: 'line', x1: 10, y1: 11, x2: 10, y2: 14 },
    { kind: 'path', d: 'M7 16h6l-.7-2H7.7Z' },
  ],
  FLAG: [
    { kind: 'line', x1: 5, y1: 3, x2: 5, y2: 17 },
    { kind: 'path', d: 'M5 4h10l-3 3 3 3H5Z' },
  ],
  CALENDAR: [
    { kind: 'rect', x: 3, y: 4, width: 14, height: 13, rx: 2 },
    { kind: 'line', x1: 7, y1: 2, x2: 7, y2: 6 },
    { kind: 'line', x1: 13, y1: 2, x2: 13, y2: 6 },
    { kind: 'line', x1: 3, y1: 9, x2: 17, y2: 9 },
  ],
  CLOCK: [
    { kind: 'circle', cx: 10, cy: 10, r: 7.5 },
    { kind: 'path', d: 'M10 6v4l3 2' },
  ],
  BALL: [
    { kind: 'circle', cx: 10, cy: 10, r: 7.5 },
    { kind: 'path', d: 'M4.5 7.5Q10 10.5 15.5 7.5' },
    { kind: 'path', d: 'M4.5 12.5Q10 9.5 15.5 12.5' },
  ],
  BELL: [
    {
      kind: 'path',
      d: 'M10 2.5c-2.2 0-4 1.8-4 4v3.5c0 1-.4 2-1.2 2.7L4 13.5h12l-.8-.8c-.8-.7-1.2-1.7-1.2-2.7V6.5c0-2.2-1.8-4-4-4Z',
    },
    { kind: 'path', d: 'M8.5 15.5a1.5 1.5 0 0 0 3 0' },
  ],
  BOLT: [{ kind: 'path', d: 'M11 2 3 12h5l-1 6 8-10h-5l1-6Z', fill: 'currentColor' }],
  TARGET: [
    { kind: 'circle', cx: 10, cy: 10, r: 7.5 },
    { kind: 'circle', cx: 10, cy: 10, r: 4.2 },
    { kind: 'circle', cx: 10, cy: 10, r: 1.2, fill: 'currentColor' },
  ],
  GLOBE: [
    { kind: 'circle', cx: 10, cy: 10, r: 7.5 },
    { kind: 'ellipse', cx: 10, cy: 10, rx: 3.2, ry: 7.5 },
    { kind: 'line', x1: 2.5, y1: 10, x2: 17.5, y2: 10 },
  ],
  MEDAL: [
    { kind: 'path', d: 'M7 3 4.3 9.8' },
    { kind: 'path', d: 'M13 3 15.7 9.8' },
    { kind: 'circle', cx: 10, cy: 13, r: 4.5 },
    { kind: 'circle', cx: 10, cy: 13, r: 1.2, fill: 'currentColor' },
  ],
  CHART: [
    { kind: 'line', x1: 3, y1: 16.5, x2: 17, y2: 16.5 },
    { kind: 'line', x1: 6, y1: 15, x2: 6, y2: 9 },
    { kind: 'line', x1: 10, y1: 15, x2: 10, y2: 5 },
    { kind: 'line', x1: 14, y1: 15, x2: 14, y2: 11 },
  ],
  HEART: [
    {
      kind: 'path',
      d: 'M10 16.5 3.9 10.6C2.2 9 2.2 6.4 3.9 4.8 5.4 3.4 7.7 3.5 9.1 5l.9.9.9-.9c1.4-1.5 3.7-1.6 5.2-.2 1.7 1.6 1.7 4.2 0 5.8Z',
      fill: 'currentColor',
    },
  ],
  GRID: [
    { kind: 'rect', x: 3, y: 3, width: 6, height: 6, rx: 1.3 },
    { kind: 'rect', x: 11, y: 3, width: 6, height: 6, rx: 1.3 },
    { kind: 'rect', x: 3, y: 11, width: 6, height: 6, rx: 1.3 },
    { kind: 'rect', x: 11, y: 11, width: 6, height: 6, rx: 1.3 },
  ],
  COMPASS: [
    { kind: 'circle', cx: 10, cy: 10, r: 7.5 },
    { kind: 'path', d: 'M13 7 11 11 7 13 9 9Z', fill: 'currentColor' },
  ],
};

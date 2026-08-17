/**
 * Shape of every brand-configurable color zone (background, button/CTA,
 * highlight, filter, text) - each stored as its own JSON column on Brand
 * (see schema.prisma), always carrying both a light and a dark value so
 * switching theme never loses the other's configuration. Each value is
 * either a solid hex or a 2-stop gradient with a direction, picked
 * independently per zone per theme.
 */
export type GradientDirection = 'to-t' | 'to-b' | 'to-l' | 'to-r' | 'to-tl' | 'to-tr' | 'to-bl' | 'to-br';

export const GRADIENT_DIRECTIONS: GradientDirection[] = [
  'to-t',
  'to-b',
  'to-l',
  'to-r',
  'to-tl',
  'to-tr',
  'to-bl',
  'to-br',
];

export interface SolidColor {
  type: 'solid';
  hex: string;
}

export interface GradientColor {
  type: 'gradient';
  direction: GradientDirection;
  fromHex: string;
  toHex: string;
}

export type ColorValue = SolidColor | GradientColor;

export interface ColorZone {
  light: ColorValue;
  dark: ColorValue;
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX_PATTERN.test(value);
}

export function isColorValue(value: unknown): value is ColorValue {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (candidate.type === 'solid') {
    return isHex(candidate.hex);
  }
  if (candidate.type === 'gradient') {
    return (
      typeof candidate.direction === 'string' &&
      GRADIENT_DIRECTIONS.includes(candidate.direction as GradientDirection) &&
      isHex(candidate.fromHex) &&
      isHex(candidate.toHex)
    );
  }
  return false;
}

export function isColorZone(value: unknown): value is ColorZone {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return isColorValue(candidate.light) && isColorValue(candidate.dark);
}

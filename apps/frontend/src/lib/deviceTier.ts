/**
 * A real desktop browser (mouse + hover support) vs a touch/coarse-pointer
 * device - see useDeviceTier below for why this, not viewport width, is
 * what actually decides the persistent-columns-vs-drawer layout split.
 */
export const DESKTOP_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/**
 * True for a real tablet, in either orientation - false for a phone, even a
 * large one turned sideways. A plain min-width check can't tell those
 * apart: a phone in landscape can easily exceed 640px (or even 1024px on
 * the largest phones) CSS width, which would otherwise get mistaken for
 * tablet-or-desktop width. Checking min-width AND min-height together
 * instead effectively checks the viewport's *shorter* side - a phone's
 * short side stays under ~480px in any orientation, while a real tablet's
 * short side is comfortably above 600px in any orientation, so this holds
 * regardless of how the device is held.
 */
export const AT_LEAST_TABLET_DIMENSIONS_QUERY = '(min-width: 600px) and (min-height: 600px)';

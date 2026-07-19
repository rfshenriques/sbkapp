import football from '../../assets/sport-icons/football.png';
import tennis from '../../assets/sport-icons/tennis.png';
import basketball from '../../assets/sport-icons/basketball.png';
import americanFootball from '../../assets/sport-icons/american-football.png';
import mma from '../../assets/sport-icons/mma.png';

/**
 * Provided icon pack (apps/frontend/src/assets/sport-icons) - full-bleed
 * circular art, transparent background. Only sports with a matching asset
 * are here; everything else (Ice Hockey, anything unmapped) falls back to
 * hand-drawn artwork in sportGlyphs.tsx until a matching icon exists.
 *
 * MMA and Boxing share the same fist icon for now (explicit call - all
 * "fighting sports" get one icon until they're split out later).
 */
export const SPORT_ICON_IMAGE: Record<string, string> = {
  Football: football,
  Tennis: tennis,
  Basketball: basketball,
  'American Football': americanFootball,
  MMA: mma,
  Boxing: mma,
};

import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { ROUND_SPORT_EMOJI, SportGlyph } from './sportGlyphs';

interface SportIconProps {
  sport: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function SportIcon({ sport, size = 18, className, style }: SportIconProps) {
  const emoji = ROUND_SPORT_EMOJI[sport];

  return (
    <span
      role="img"
      aria-label={sport}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#20242e] leading-none shadow-[0_0_0_1px_rgba(0,0,0,0.14)]',
        className,
      )}
      style={{ width: size, height: size, ...style }}
    >
      {emoji ? (
        <span style={{ fontSize: size * 0.72 }}>{emoji}</span>
      ) : (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <SportGlyph sport={sport} />
        </svg>
      )}
    </span>
  );
}

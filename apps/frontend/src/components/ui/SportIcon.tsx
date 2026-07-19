import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { SportGlyph } from './sportGlyphs';
import { SPORT_ICON_IMAGE } from './sportIconImages';

interface SportIconProps {
  sport: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function SportIcon({ sport, size = 18, className, style }: SportIconProps) {
  const image = SPORT_ICON_IMAGE[sport];

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
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <SportGlyph sport={sport} />
        </svg>
      )}
    </span>
  );
}

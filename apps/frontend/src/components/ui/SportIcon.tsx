import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { SportGlyph } from './sportGlyphs';

interface SportIconProps {
  sport: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function SportIcon({ sport, size = 18, className, style }: SportIconProps) {
  return (
    <span
      role="img"
      aria-label={sport}
      className={cn(
        'inline-block shrink-0 overflow-hidden rounded-full leading-none shadow-[0_0_0_1px_rgba(0,0,0,0.14)]',
        className,
      )}
      style={{ width: size, height: size, ...style }}
    >
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <SportGlyph sport={sport} />
      </svg>
    </span>
  );
}

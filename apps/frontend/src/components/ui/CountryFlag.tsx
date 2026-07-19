import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { FlagGlyph } from './flagGlyphs';

interface CountryFlagProps {
  country: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function CountryFlag({ country, size = 18, className, style }: CountryFlagProps) {
  return (
    <span
      role="img"
      aria-label={country}
      className={cn(
        'inline-block shrink-0 overflow-hidden rounded-full leading-none shadow-[0_0_0_1px_rgba(0,0,0,0.14)]',
        className,
      )}
      style={{ width: size, height: size, ...style }}
    >
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <FlagGlyph country={country} />
      </svg>
    </span>
  );
}

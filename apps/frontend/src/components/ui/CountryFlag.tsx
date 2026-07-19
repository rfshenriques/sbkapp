import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { FlagGlyph, hasFlagGlyph } from './flagGlyphs';
import globe from '../../assets/sport-icons/globe.png';

interface CountryFlagProps {
  country: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function CountryFlag({ country, size = 18, className, style }: CountryFlagProps) {
  const isRealFlag = hasFlagGlyph(country);

  return (
    <span
      role="img"
      aria-label={country}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full leading-none shadow-[0_0_0_1px_rgba(0,0,0,0.14)]',
        className,
      )}
      style={{ width: size, height: size, ...style }}
    >
      {isRealFlag ? (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <FlagGlyph country={country} />
        </svg>
      ) : (
        <img src={globe} alt="" className="h-full w-full object-cover" />
      )}
      {/* Subtle inner white glow ring, just inside the edge - matches the
          reference icon pack's flag style. A soft double stroke rather than
          an SVG blur filter, so it doesn't need a unique filter id per
          instance. */}
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <circle cx="16" cy="16" r="14.4" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="2.4" />
        <circle cx="16" cy="16" r="15.3" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1" />
      </svg>
    </span>
  );
}

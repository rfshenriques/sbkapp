import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { countryFlag } from '../../lib/countryFlags';

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
        'inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 leading-none',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.6, ...style }}
    >
      {countryFlag(country)}
    </span>
  );
}

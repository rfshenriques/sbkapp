import { SportIcon } from './SportIcon';
import { CountryFlag } from './CountryFlag';

interface SportCountryBadgeProps {
  sport: string;
  country: string;
  size?: number;
  className?: string;
}

/**
 * The sport icon and country flag as a single overlapping pair, sport
 * first (rendered first, sits behind) with the flag positioned on top,
 * shifted left so it covers 30% of the sport icon's width - used
 * everywhere a match shows its sport + competition together.
 */
export function SportCountryBadge({ sport, country, size = 18, className }: SportCountryBadgeProps) {
  const overlap = size * 0.3;

  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size * 2 - overlap,
        height: size,
      }}
    >
      <SportIcon sport={sport} size={size} className="absolute top-0 left-0 border-2 border-surface" />
      <CountryFlag
        country={country}
        size={size}
        className="absolute top-0 border-2 border-surface"
        style={{ left: size - overlap }}
      />
    </span>
  );
}

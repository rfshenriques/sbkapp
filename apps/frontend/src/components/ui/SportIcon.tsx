import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { sportIcon } from '../../lib/sportIcons';

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
        'inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 leading-none',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.6, ...style }}
    >
      {sportIcon(sport)}
    </span>
  );
}

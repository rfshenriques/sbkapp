import { cn } from '../../lib/cn';

interface TeamColorAccentProps {
  colorHex: string | undefined;
  className?: string;
}

/** A small colored edge marker for a team - only rendered once an admin has actually assigned that team a real color (see the backoffice Team Colors page); renders nothing otherwise rather than guessing one. */
export function TeamColorAccent({ colorHex, className }: TeamColorAccentProps) {
  if (!colorHex) return null;

  return (
    <span
      aria-hidden="true"
      className={cn('h-3.5 w-1 shrink-0 rounded-full', className)}
      style={{ backgroundColor: colorHex }}
    />
  );
}

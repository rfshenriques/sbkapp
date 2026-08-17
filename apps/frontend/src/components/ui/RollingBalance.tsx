import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import { formatCents } from '../../features/wallet/useWallet';

const CYCLE_DIGITS = Array.from({ length: 20 }, (_, i) => i % 10);

interface RollingDigitProps {
  from: number;
  to: number;
  delayMs?: number;
  durationMs?: number;
}

/**
 * A single digit that odometer-rolls from `from` to `to` on mount. The
 * digit strip repeats 0-9 twice (20 rows) so the target row - computed as
 * `from + ((to - from + 10) % 10)` - always lands further down the strip
 * than the start, meaning the animation only ever spins forward (down),
 * never backward, even across a 9->0 carry.
 */
function RollingDigit({ from, to, delayMs = 0, durationMs = 700 }: RollingDigitProps) {
  const [position, setPosition] = useState(from);

  useEffect(() => {
    const target = from + ((to - from + 10) % 10);
    // Two nested rAFs: the first commits the initial (from) position paint,
    // the second flips to the target so the CSS transition actually fires
    // instead of jumping straight there on the same frame it mounted.
    const outer = requestAnimationFrame(() => {
      const inner = requestAnimationFrame(() => setPosition(target));
      return () => cancelAnimationFrame(inner);
    });
    return () => cancelAnimationFrame(outer);
  }, [from, to]);

  return (
    <span className="inline-block h-[1em] overflow-hidden align-bottom" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <span
        className="block"
        style={{
          transform: `translateY(-${position}em)`,
          transition: `transform ${durationMs}ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms`,
        }}
      >
        {CYCLE_DIGITS.map((digit, i) => (
          <span key={i} className="block h-[1em] text-center leading-[1em]">
            {digit}
          </span>
        ))}
      </span>
    </span>
  );
}

interface RollingBalanceProps {
  fromCents: number;
  toCents: number;
  className?: string;
}

/** Renders formatCents(toCents), each digit odometer-rolling up from the corresponding digit of formatCents(fromCents) - the header balance's "counting up" effect while FreebetFlyOverlay's icons arrive. Non-digit characters (the decimal point, the currency symbol) render statically. */
export function RollingBalance({ fromCents, toCents, className }: RollingBalanceProps) {
  const fromStr = formatCents(Math.max(fromCents, 0));
  const toStr = formatCents(Math.max(toCents, 0));
  const width = Math.max(fromStr.length, toStr.length);
  const paddedFrom = fromStr.padStart(width, '0');
  const paddedTo = toStr.padStart(width, '0');

  return (
    <span className={cn('inline-flex items-baseline', className)}>
      {paddedTo.split('').map((char, i) => {
        if (/\d/.test(char)) {
          return <RollingDigit key={i} from={Number(paddedFrom[i])} to={Number(char)} delayMs={i * 40} />;
        }
        return (
          <span key={i} className="inline-block">
            {char}
          </span>
        );
      })}
    </span>
  );
}

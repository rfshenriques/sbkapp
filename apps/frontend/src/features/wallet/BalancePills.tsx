import { TicketIcon, WalletIcon } from '../../components/ui/NavIcons';
import { cn } from '../../lib/cn';
import { formatCents } from './useWallet';

interface BalancePillsProps {
  cashCents: number;
  freebetsCents: number;
  className?: string;
  /** Which pill to ring in --color-highlight - the bet slip uses this to show which balance the Cash/Freebets switch is currently staking from. Omitted anywhere that switch doesn't exist (the header). */
  activeKind?: 'cash' | 'freebets';
}

/**
 * Icon + value pair for cash, and (only when non-zero) another for
 * freebets - the one balance display shared by the header and the bet
 * slip, mobile and desktop alike, so a player sees the same two pills
 * wherever a balance shows up rather than a different format per surface.
 * Freebets stay hidden at zero rather than showing a permanent "€0.00"
 * pill that's never actionable for most players.
 */
export function BalancePills({ cashCents, freebetsCents, className, activeKind }: BalancePillsProps) {
  return (
    <span className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <span
        className={cn(
          'flex items-center gap-1 rounded-full border bg-surface-2 px-2 py-1 text-xs text-text-secondary',
          activeKind === 'cash' ? 'border-highlight' : 'border-transparent',
        )}
        title="Cash balance (paper)"
      >
        <WalletIcon width={14} height={14} className="shrink-0" />
        <span className="font-semibold text-text-primary">€{formatCents(cashCents)}</span>
      </span>
      {freebetsCents > 0 && (
        <span
          className={cn(
            'flex items-center gap-1 rounded-full border bg-surface-2 px-2 py-1 text-xs text-text-secondary',
            activeKind === 'freebets' ? 'border-highlight' : 'border-transparent',
          )}
          title="Freebets balance"
        >
          <TicketIcon width={14} height={14} className="shrink-0" />
          <span className="font-semibold text-text-primary">€{formatCents(freebetsCents)}</span>
        </span>
      )}
    </span>
  );
}

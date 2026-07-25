import { TicketIcon, WalletIcon } from '../../components/ui/NavIcons';
import { formatCents } from './useWallet';

interface BalancePillsProps {
  cashCents: number;
  freebetsCents: number;
  className?: string;
}

/**
 * Icon + value pair for cash, and (only when non-zero) another for
 * freebets - the one balance display shared by the header and the bet
 * slip, mobile and desktop alike, so a player sees the same two pills
 * wherever a balance shows up rather than a different format per surface.
 * Freebets stay hidden at zero rather than showing a permanent "€0.00"
 * pill that's never actionable for most players.
 */
export function BalancePills({ cashCents, freebetsCents, className }: BalancePillsProps) {
  return (
    <span className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <span
        className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs text-text-secondary"
        title="Cash balance (paper)"
      >
        <WalletIcon width={14} height={14} className="shrink-0" />
        <span className="font-semibold text-text-primary">€{formatCents(cashCents)}</span>
      </span>
      {freebetsCents > 0 && (
        <span
          className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs text-text-secondary"
          title="Freebets balance"
        >
          <TicketIcon width={14} height={14} className="shrink-0" />
          <span className="font-semibold text-text-primary">€{formatCents(freebetsCents)}</span>
        </span>
      )}
    </span>
  );
}

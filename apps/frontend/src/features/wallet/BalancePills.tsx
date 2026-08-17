import { RollingBalance } from '../../components/ui/RollingBalance';
import { FreebetBadgeIcon, GiftBadgeIcon, WalletIcon } from '../../components/ui/NavIcons';
import { cn } from '../../lib/cn';
import { useFreebetFlyStore } from './freebetFlyStore';
import { formatCents } from './useWallet';

interface BalancePillsProps {
  cashCents: number;
  freebetsCents: number;
  className?: string;
  /** Which pill to ring in --color-highlight - the bet slip uses this to show which balance the Cash/Freebets switch is currently staking from. Omitted anywhere that switch doesn't exist (the header). */
  activeKind?: 'cash' | 'freebets';
  /** Renders a small brand-colored "+" button inside the cash pill itself - the header's add-funds entry point. Omitted anywhere that action doesn't apply (the bet slip). */
  onAddFunds?: () => void;
  /**
   * DOM id to give the freebets pill and the fly-animation target to aim
   * at - only passed by the header's own BalancePills usage (AppShell), so
   * FreebetFlyOverlay's icons and the RollingBalance swap below only ever
   * apply to that one instance, never the bet slip's separate pill.
   */
  freebetsTargetId?: string;
  /** Shows a small green gift-badge in the cash pill's corner when this player has an eligible, unredeemed deposit campaign - header-only, same as onAddFunds. */
  hasEligibleDepositCampaign?: boolean;
}

/**
 * Icon + value pair for cash, and (only when non-zero) another for
 * freebets - the one balance display shared by the header and the bet
 * slip, mobile and desktop alike, so a player sees the same two pills
 * wherever a balance shows up rather than a different format per surface.
 * Freebets stay hidden at zero rather than showing a permanent "0.00 €"
 * pill that's never actionable for most players.
 */
export function BalancePills({
  cashCents,
  freebetsCents,
  className,
  activeKind,
  onAddFunds,
  freebetsTargetId,
  hasEligibleDepositCampaign,
}: BalancePillsProps) {
  const flyActive = useFreebetFlyStore((state) => state.active);
  const flyTargetId = useFreebetFlyStore((state) => state.targetId);
  const flyFromCents = useFreebetFlyStore((state) => state.fromCents);
  const flyToCents = useFreebetFlyStore((state) => state.toCents);
  const isFlyTarget = flyActive && freebetsTargetId !== undefined && flyTargetId === freebetsTargetId;

  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${className ?? ''}`}>
      <span
        className={cn(
          'relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border bg-surface-2 px-2 py-1 text-xs text-text-secondary',
          activeKind === 'cash' ? 'border-highlight' : 'border-transparent',
        )}
        title="Cash balance (paper)"
      >
        {hasEligibleDepositCampaign && (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-background"
            title="A deposit bonus is available"
          >
            <GiftBadgeIcon width={16} height={16} />
          </span>
        )}
        <WalletIcon width={14} height={14} className="shrink-0" />
        <span className="font-semibold text-text-primary">{formatCents(cashCents)}</span>
        {onAddFunds && (
          <button
            type="button"
            onClick={onAddFunds}
            aria-label="Add funds"
            title="Add funds"
            className="-my-1 -mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold leading-none text-white transition-transform hover:brightness-110 active:scale-90"
          >
            +
          </button>
        )}
      </span>
      {freebetsCents > 0 && (
        <span
          id={freebetsTargetId}
          className={cn(
            'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border bg-surface-2 px-2 py-1 text-xs text-text-secondary',
            activeKind === 'freebets' ? 'border-highlight' : 'border-transparent',
          )}
          title="Freebets balance"
        >
          <FreebetBadgeIcon width={15} height={15} className="shrink-0" />
          <span className="font-semibold text-text-primary">
            {isFlyTarget ? <RollingBalance fromCents={flyFromCents} toCents={flyToCents} /> : formatCents(freebetsCents)}
          </span>
        </span>
      )}
    </span>
  );
}

import type { ReactNode } from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { ChevronIcon } from '../../components/ui/ChevronIcon';
import { AccountIcon, MyBetsIcon } from '../../components/ui/NavIcons';
import { cn } from '../../lib/cn';
import { useDepositModalStore } from '../deposit/depositModalStore';
import { BalancePills } from '../wallet/BalancePills';
import { sumFreebetsCents, useFreebets } from '../wallet/useFreebets';
import { useWallet } from '../wallet/useWallet';
import { useAuth } from './useAuth';

function AccountLinkRow({
  to,
  icon,
  children,
  onNavigate,
}: {
  to: string;
  icon?: ReactNode;
  children: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-2"
    >
      {icon}
      <span className="flex-1">{children}</span>
      <ChevronIcon width={16} height={16} className="-rotate-90 text-text-muted" />
    </Link>
  );
}

/**
 * Full-screen (mobile) / centered-dialog (desktop) account modal - same
 * BottomSheet presentation as every other player-facing modal - replacing
 * the old floating dropdown. Only surfaces sections backed by real data or
 * real pages: balance + Add funds (wallet/deposit flow), My Bets,
 * Responsible Gambling, Log out. No payment methods/messages/documents/
 * security/notifications sections - those pages don't exist yet.
 */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const { data: wallet } = useWallet();
  const { data: freebets } = useFreebets();
  const freebetsCents = sumFreebetsCents(freebets);
  const openDepositModal = useDepositModalStore((state) => state.open);

  function close() {
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Account"
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-text-secondary transition-colors hover:text-text-primary',
          isOpen && 'text-highlight',
        )}
      >
        <AccountIcon width={18} height={18} />
      </button>

      {isOpen &&
        createPortal(
          <BottomSheet
            title="Account"
            icon={<AccountIcon width={20} height={20} />}
            onClose={close}
            closeLabel="Close account"
            mobileHeightClassName="h-[92dvh]"
            footer={
              <button
                type="button"
                onClick={() => {
                  close();
                  void logout();
                }}
                className="w-full rounded-xl border border-danger/40 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
              >
                Log out
              </button>
            }
          >
            <div className="space-y-5">
              <div>
                <p className="truncate font-display text-lg">{user?.username}</p>
                <p className="truncate text-sm text-text-muted">{user?.email}</p>
              </div>

              <div className="rounded-2xl border border-border bg-surface-2 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Balance</p>
                {wallet && (
                  <div className="mt-2.5">
                    <BalancePills cashCents={wallet.balanceCents} freebetsCents={freebetsCents} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    close();
                    openDepositModal();
                  }}
                  className="btn-primary mt-3.5 w-full"
                >
                  Add funds
                </button>
              </div>

              <div className="space-y-1">
                <AccountLinkRow to="/my-bets" icon={<MyBetsIcon width={18} height={18} />} onNavigate={close}>
                  My Bets
                </AccountLinkRow>
                <AccountLinkRow to="/responsible-gambling" onNavigate={close}>
                  Responsible Gambling
                </AccountLinkRow>
              </div>
            </div>
          </BottomSheet>,
          document.body,
        )}
    </>
  );
}

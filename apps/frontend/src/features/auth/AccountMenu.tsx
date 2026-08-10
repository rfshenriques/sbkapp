import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Card } from '../../components/ui/Card';
import { ChevronIcon } from '../../components/ui/ChevronIcon';
import { AccountIcon, GearIcon, MyBetsIcon, ShieldIcon } from '../../components/ui/NavIcons';
import { Switch } from '../../components/ui/Switch';
import { SunMoonToggle } from '../../components/ui/SunMoonToggle';
import { getPublicBrand } from '../../lib/backendApi';
import { cn } from '../../lib/cn';
import { useThemePreferenceStore } from '../theme/themePreferenceStore';
import { useDepositModalStore } from '../deposit/depositModalStore';
import { usePushSubscription } from '../push/usePushSubscription';
import { BalancePills } from '../wallet/BalancePills';
import { sumFreebetsCents, useFreebets } from '../wallet/useFreebets';
import { useWallet } from '../wallet/useWallet';
import { useAuth } from './useAuth';

type AccountView = 'menu' | 'settings' | 'responsible-gambling';

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

/** Same visual row as AccountLinkRow, but opens a sub-view inside this
 * same sheet (see AccountView) instead of navigating to a separate route -
 * used for the two small, self-contained settings-style pages (Settings,
 * Responsible Gambling). My Bets stays a real route: it's already a
 * primary bottom-nav destination and a much heavier page (its own
 * fetching/filters), so embedding it here would duplicate rather than
 * simplify. */
function AccountViewRow({ icon, children, onOpen }: { icon?: ReactNode; children: ReactNode; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-text-primary transition-colors hover:bg-surface-2"
    >
      {icon}
      <span className="flex-1">{children}</span>
      <ChevronIcon width={16} height={16} className="-rotate-90 text-text-muted" />
    </button>
  );
}

/** Same content as SettingsPage, without its own page heading - the sheet's
 * own title bar already shows "Settings" once this view is active. */
function SettingsView() {
  const preference = useThemePreferenceStore((state) => state.preference);
  const setPreference = useThemePreferenceStore((state) => state.setPreference);
  const { data: brand } = useQuery({
    queryKey: ['public-brand', typeof window === 'undefined' ? '' : window.location.hostname],
    queryFn: getPublicBrand,
    staleTime: Infinity,
  });
  const isDark = preference ? preference === 'dark' : brand?.themeMode !== 'LIGHT';

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-text-primary">Appearance</p>
        <p className="text-xs text-text-muted">Choose how the app looks on this device.</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className={cn(!isDark ? 'text-text-primary' : 'text-text-muted', 'text-sm font-semibold')}>Light</span>
        <SunMoonToggle
          checked={isDark}
          onChange={(checked) => setPreference(checked ? 'dark' : 'light')}
          ariaLabel="Dark mode"
          id="account-theme-toggle"
        />
        <span className={cn(isDark ? 'text-text-primary' : 'text-text-muted', 'text-sm font-semibold')}>Dark</span>
      </div>

      {preference && (
        <button
          type="button"
          onClick={() => setPreference(null)}
          className="text-xs font-semibold text-highlight hover:underline"
        >
          Use site default
        </button>
      )}
    </Card>
  );
}

/** Same content as ResponsibleGamblingPage, without its own page heading. */
function ResponsibleGamblingView() {
  const { data: brand } = useQuery({
    queryKey: ['public-brand', typeof window === 'undefined' ? '' : window.location.hostname],
    queryFn: getPublicBrand,
    staleTime: Infinity,
  });

  return (
    <div className="space-y-4">
      <Card className="space-y-2 text-sm text-text-secondary">
        <p>You must be at least 18 years old to register an account and place bets.</p>
        <p>
          Gambling should be an enjoyable form of entertainment, not a way to make money or escape problems. Only
          bet what you can afford to lose, and take regular breaks.
        </p>
        <p>
          If you feel your gambling is becoming a problem, contact your account manager or use your account
          settings to set deposit limits, take a time-out, or self-exclude.
        </p>
      </Card>

      <Card className="text-sm text-text-secondary">
        {brand?.supportHelplineText ? (
          <p>{brand.supportHelplineText}</p>
        ) : (
          <p>Need help? Contact support for guidance on responsible gambling tools.</p>
        )}
      </Card>
    </div>
  );
}

/**
 * Full-screen (mobile) / centered-dialog (desktop) account modal - same
 * BottomSheet presentation as every other player-facing modal - replacing
 * the old floating dropdown. Only surfaces sections backed by real data or
 * real pages: balance + Add funds (wallet/deposit flow), My Bets, push
 * notifications, Responsible Gambling, Log out. No payment methods/
 * messages/documents/security sections - those pages don't exist yet.
 */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AccountView>('menu');
  const { data: wallet } = useWallet();
  const { data: freebets } = useFreebets();
  const freebetsCents = sumFreebetsCents(freebets);
  const openDepositModal = useDepositModalStore((state) => state.open);
  const push = usePushSubscription();

  function close() {
    setIsOpen(false);
    // Reset after the close animation would have finished rather than
    // immediately - an immediate reset would flash the main menu's title/
    // icon in place of whatever sub-view was open for the brief moment
    // before the sheet unmounts.
    setTimeout(() => setView('menu'), 250);
  }

  const sheetProps: Record<AccountView, { title: string; icon: ReactNode }> = {
    menu: { title: 'Account', icon: <AccountIcon width={20} height={20} /> },
    settings: { title: 'Settings', icon: <GearIcon width={20} height={20} /> },
    'responsible-gambling': {
      title: 'Responsible Gambling',
      icon: <ShieldIcon width={20} height={20} />,
    },
  };

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
            title={sheetProps[view].title}
            icon={sheetProps[view].icon}
            onClose={close}
            closeLabel="Close account"
            onBack={view !== 'menu' ? () => setView('menu') : undefined}
            backLabel="Back to account menu"
            mobileHeightClassName="h-[92dvh]"
            footer={
              view === 'menu' ? (
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
              ) : undefined
            }
          >
            {view === 'settings' ? (
              <SettingsView />
            ) : view === 'responsible-gambling' ? (
              <ResponsibleGamblingView />
            ) : (
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
                <AccountViewRow icon={<ShieldIcon width={18} height={18} />} onOpen={() => setView('responsible-gambling')}>
                  Responsible Gambling
                </AccountViewRow>
                <AccountViewRow icon={<GearIcon width={18} height={18} />} onOpen={() => setView('settings')}>
                  Settings
                </AccountViewRow>
              </div>

              {push.isSupported && (
                <div className="rounded-2xl border border-border bg-surface-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Push notifications</p>
                      <p className="text-xs text-text-muted">
                        Get notified on this device when a bet settles and about offers.
                      </p>
                    </div>
                    <Switch
                      checked={push.isSubscribed}
                      onChange={(checked) => void (checked ? push.enable() : push.disable())}
                      ariaLabel="Push notifications"
                      id="push-toggle"
                    />
                  </div>
                  {push.permission === 'denied' && (
                    <p className="mt-2 text-xs text-danger">
                      Notifications are blocked for this app at the device level. Enable them in your device's
                      Settings app, then reopen this app.
                    </p>
                  )}
                  {push.error && <p className="mt-2 text-xs text-danger">{push.error}</p>}
                </div>
              )}
            </div>
            )}
          </BottomSheet>,
          document.body,
        )}
    </>
  );
}

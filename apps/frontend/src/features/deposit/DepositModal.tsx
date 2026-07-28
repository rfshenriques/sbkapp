import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { LockIcon } from '../../components/ui/LockIcon';
import { FreebetBadgeIcon, WalletIcon } from '../../components/ui/NavIcons';
import * as backendApi from '../../lib/backendApi';
import type { DepositResult } from '../../lib/backendApi';
import { cn } from '../../lib/cn';
import { formatRewardHeadline } from '../deposit-campaigns/DepositCampaignModal';
import { useEligibleDepositCampaign } from '../deposit-campaigns/useEligibleDepositCampaign';
import { freebetsQueryKey } from '../wallet/useFreebets';
import { walletQueryKey } from '../wallet/useWallet';
import { useDepositModalStore } from './depositModalStore';

const DEPOSIT_FORM_ID = 'deposit-form';
const PRESET_AMOUNTS = [10, 20, 30, 50];

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Generic paper-money top-up - opened from the header's cash balance "+"
 * button and from the bet slip's insufficient-funds prompt, as opposed to
 * DepositCampaignModal which only ever opens already bound to one specific
 * promotion. Uses the same recordDeposit endpoint, which resolves and
 * applies any eligible deposit campaign server-side regardless of which
 * modal triggered it - a reward still shows up here if one applies.
 */
export function DepositModal() {
  const isOpen = useDepositModalStore((state) => state.isOpen);
  const close = useDepositModalStore((state) => state.close);
  const queryClient = useQueryClient();
  const { data: eligibleCampaign } = useEligibleDepositCampaign();
  const [amount, setAmount] = useState('20');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<DepositResult | null>(null);

  if (!isOpen) {
    return null;
  }

  const amountCents = Math.round(Number(amount) * 100);
  const isValidAmount = Number.isFinite(amountCents) && amountCents > 0;
  const meetsCampaignMinimum = Boolean(eligibleCampaign) && amountCents >= eligibleCampaign!.minDepositAmountCents;

  function handleClose() {
    close();
    setAmount('20');
    setError(null);
    setResult(null);
  }

  function handleAmountChange(value: string) {
    if (/^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidAmount) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const depositResult = await backendApi.recordDeposit(amountCents);
      setResult(depositResult);
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
      void queryClient.invalidateQueries({ queryKey: freebetsQueryKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BottomSheet
      title="Add funds"
      icon={<WalletIcon width={20} height={20} className="text-highlight" />}
      onClose={handleClose}
      closeLabel="Close deposit"
      footer={
        result ? (
          <button type="button" onClick={handleClose} className="btn-primary w-full">
            Done
          </button>
        ) : (
          <>
            <button
              type="submit"
              form={DEPOSIT_FORM_ID}
              disabled={isSubmitting || !isValidAmount}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Depositing…' : `Deposit ${isValidAmount ? formatCents(amountCents) : '0.00'} €`}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-text-muted">
              <LockIcon width={12} height={12} />
              Secure, instant deposit
            </p>
          </>
        )
      }
    >
      {result ? (
        result.redemption ? (
          <p className="text-center text-sm text-text-primary">
            Deposit successful! A {formatCents(result.redemption.rewardAmountCents)} € freebet has been added to
            your account.
          </p>
        ) : (
          <p className="text-center text-sm text-text-secondary">
            Your deposit of {formatCents(result.deposit.amountCents)} € was successful.
          </p>
        )
      ) : (
        <form id={DEPOSIT_FORM_ID} onSubmit={handleSubmit} className="space-y-6">
          {eligibleCampaign && (
            <div
              className={cn(
                'rounded-xl border p-3 transition-all duration-300',
                meetsCampaignMinimum
                  ? 'scale-[1.02] border-price-up bg-price-up/15'
                  : 'border-highlight/40 bg-highlight/10',
              )}
            >
              <div className="flex items-center gap-3">
                <FreebetBadgeIcon width={28} height={28} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">{eligibleCampaign.name}</p>
                  <p
                    className={cn(
                      'font-display text-2xl leading-none font-extrabold transition-colors duration-300',
                      meetsCampaignMinimum ? 'text-price-up' : 'text-highlight',
                    )}
                  >
                    {formatRewardHeadline(eligibleCampaign).figure}{' '}
                    <span className="text-xs font-semibold">{formatRewardHeadline(eligibleCampaign).caption}</span>
                  </p>
                </div>
              </div>
              <p
                className={cn(
                  'mt-2 text-xs font-semibold transition-colors duration-300',
                  meetsCampaignMinimum ? 'text-price-up' : 'text-text-secondary',
                )}
              >
                {meetsCampaignMinimum
                  ? '✅ This deposit qualifies for the reward!'
                  : `Deposit at least ${formatCents(eligibleCampaign.minDepositAmountCents)} € to unlock this reward.`}
              </p>
            </div>
          )}
          <div className="flex flex-col items-center gap-1 border-b border-border py-3">
            <label
              htmlFor="deposit-amount"
              className="text-xs font-semibold uppercase tracking-wide text-text-muted"
            >
              Amount
            </label>
            <div className="flex items-baseline justify-center gap-1">
              <input
                id="deposit-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => handleAmountChange(event.target.value)}
                className="font-display w-32 bg-transparent text-center text-5xl leading-none text-text-primary outline-none"
                required
              />
              <span className="font-display text-3xl leading-none text-text-secondary">€</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={`tab justify-center${Number(amount) === preset ? ' active' : ''}`}
              >
                {preset} €
              </button>
            ))}
          </div>

          {error && <p className="text-center text-sm text-danger">{error}</p>}
        </form>
      )}
    </BottomSheet>
  );
}

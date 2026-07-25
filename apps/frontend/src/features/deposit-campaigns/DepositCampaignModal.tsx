import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '../../components/ui/BottomSheet';
import * as backendApi from '../../lib/backendApi';
import type { DepositCampaign, DepositResult } from '../../lib/backendApi';
import { formatCampaignRequirements, formatCampaignTrigger } from '../bet-and-get/formatCampaignRequirements';
import { freebetsQueryKey } from '../wallet/useFreebets';
import { walletQueryKey } from '../wallet/useWallet';
import { useDepositCampaignModalStore } from './depositCampaignModalStore';

const DEPOSIT_FORM_ID = 'deposit-campaign-form';

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** One sentence describing the reward shape - fixed amount or percent-up-to-a-cap. */
function formatRewardExplanation(campaign: DepositCampaign): string {
  const minDeposit = `€${formatCents(campaign.minDepositAmountCents)}`;
  if (campaign.rewardType === 'FIXED') {
    return `Deposit ${minDeposit} or more and get a €${formatCents(campaign.fixedRewardAmountCents ?? 0)} freebet.`;
  }
  return `Get ${campaign.rewardPercent}% of your deposit as a freebet, up to €${formatCents(
    campaign.rewardCapCents ?? 0,
  )} - minimum deposit ${minDeposit}.`;
}

function SuccessMessage({ campaign, result }: { campaign: DepositCampaign; result: DepositResult }) {
  if (!result.redemption) {
    return (
      <p className="text-sm text-text-secondary">
        Your deposit of €{formatCents(result.deposit.amountCents)} was successful. This deposit didn't qualify for
        the promotion.
      </p>
    );
  }

  if (result.redemption.status === 'GRANTED') {
    return (
      <p className="text-sm text-text-primary">
        Deposit successful! A €{formatCents(result.redemption.rewardAmountCents)} freebet has been added to your
        account.
      </p>
    );
  }

  return (
    <p className="text-sm text-text-primary">
      Deposit successful! Your €{formatCents(result.redemption.rewardAmountCents)} freebet is on its way -{' '}
      {formatCampaignTrigger(campaign).toLowerCase()}
    </p>
  );
}

export function DepositCampaignModal() {
  const campaign = useDepositCampaignModalStore((state) => state.campaign);
  const close = useDepositCampaignModalStore((state) => state.close);
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<DepositResult | null>(null);

  // This component stays mounted at the AppShell level even when there's no
  // campaign to show, so a fresh campaign opening doesn't remount it -
  // reset the form explicitly instead of relying on a mount-time initializer.
  useEffect(() => {
    if (campaign) {
      setAmount(formatCents(campaign.minDepositAmountCents));
      setError(null);
      setResult(null);
    }
  }, [campaign]);

  if (!campaign) {
    return null;
  }

  const requirements = campaign.requiresBet ? formatCampaignRequirements(campaign) : [];
  const amountCents = Math.round(Number(amount) * 100);
  const isValidAmount = Number.isFinite(amountCents) && amountCents > 0;

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
      title={campaign.name}
      icon={
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
      }
      onClose={close}
      closeLabel="Close deposit offer"
      footer={
        result ? (
          <button type="button" onClick={close} className="btn-primary w-full">
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
              {isSubmitting ? 'Depositing…' : 'Deposit'}
            </button>
            <button type="button" onClick={close} className="mt-2 w-full text-center text-sm text-text-secondary hover:underline">
              Maybe later
            </button>
          </>
        )
      }
    >
      <div className="space-y-3">
        {campaign.description && <p className="text-sm text-text-secondary">{campaign.description}</p>}
        <p className="text-sm font-medium text-highlight">{formatRewardExplanation(campaign)}</p>

        {campaign.requiresBet && (
          <div className="rounded-xl bg-background p-3 text-sm text-text-secondary">
            <p>{formatCampaignTrigger(campaign)}</p>
            {requirements.length > 0 && (
              <ul className="mt-1 list-inside list-disc">
                {requirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {result ? (
          <SuccessMessage campaign={campaign} result={result} />
        ) : (
          <form id={DEPOSIT_FORM_ID} onSubmit={handleSubmit}>
            <label htmlFor="deposit-amount" className="block text-sm text-text-secondary">
              Deposit amount (€)
            </label>
            <input
              id="deposit-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm"
              required
            />
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </form>
        )}
      </div>
    </BottomSheet>
  );
}

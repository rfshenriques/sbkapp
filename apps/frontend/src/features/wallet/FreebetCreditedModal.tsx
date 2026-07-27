import { BottomSheet } from '../../components/ui/BottomSheet';
import { FreebetBadgeIcon } from '../../components/ui/NavIcons';
import { HEADER_FREEBETS_BALANCE_ID } from './balanceTargetIds';
import { useFreebetCreditedModalStore } from './freebetCreditedModalStore';
import { useFreebetFlyStore } from './freebetFlyStore';
import { formatCents } from './useWallet';
import { sumFreebetsCents, useFreebets } from './useFreebets';

/**
 * Every time a campaign (Bet & Get placement/settlement, or a deposit
 * campaign) credits a player's freebets balance, this pops up showing the
 * amount and the campaign name - see FreebetCreditedModal, follows the same
 * hero-card visual as DepositCampaignModal. Opened by
 * useFreebetGrantDetector, re-derives the grant itself from useFreebets()
 * data (only the id is stored) rather than storing the whole grant object.
 */
export function FreebetCreditedModal() {
  const grantId = useFreebetCreditedModalStore((state) => state.grantId);
  const close = useFreebetCreditedModalStore((state) => state.close);
  const triggerFly = useFreebetFlyStore((state) => state.trigger);
  const { data: freebets } = useFreebets();

  const grant = grantId ? (freebets ?? []).find((entry) => entry.id === grantId) : undefined;

  if (!grantId || !grant) {
    return null;
  }

  const totalCents = sumFreebetsCents(freebets);
  const fromCents = Math.max(totalCents - grant.amountCents, 0);

  function handleGetMyFreebets() {
    if (!grant) return;
    triggerFly({ fromCents, toCents: totalCents, targetId: HEADER_FREEBETS_BALANCE_ID });
    close();
  }

  return (
    <BottomSheet
      title={grant.campaignName ?? 'Freebet credited'}
      icon={
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
      }
      onClose={close}
      closeLabel="Close freebet credited"
      footer={
        <button type="button" onClick={handleGetMyFreebets} className="btn-primary w-full">
          Get my freebets
        </button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <FreebetBadgeIcon width={56} height={56} />
          <p className="font-display text-5xl leading-none">€{formatCents(grant.amountCents)}</p>
          <p className="text-sm font-semibold text-text-secondary">in Freebets</p>
        </div>
        <p className="text-center text-sm font-medium text-highlight">
          {grant.campaignName
            ? `You've been credited freebets from the "${grant.campaignName}" campaign.`
            : "You've been credited freebets."}
        </p>
      </div>
    </BottomSheet>
  );
}

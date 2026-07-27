import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrophyIcon } from '../../components/ui/NavIcons';
import * as backendApi from '../../lib/backendApi';
import type { PromoCardItem } from '../../lib/backendApi';
import { useDepositCampaignModalStore } from '../deposit-campaigns/depositCampaignModalStore';

export interface PromoCardTileProps {
  card: PromoCardItem;
  brandId: string;
  className?: string;
}

/**
 * One CMS-managed promo card image, with an optional title/subtitle scrim
 * and an optional click-through to its linked campaign - a Bet & Get
 * campaign navigates to its matches page, a deposit campaign reopens the
 * same modal the post-login trigger uses (see DepositCampaignModal). A card
 * with neither id set is purely decorative (no link). See apps/backend's
 * PromoCardService and the backoffice's CMS Promo Cards page.
 *
 * The bright highlight-colored ring and trophy corner badge mark this as a
 * "challenge" (see ChallengesPage) - decorative framing only, since neither
 * campaign type has a real progress/status field to render (no fabricated
 * "expired"/"won" state).
 */
export function PromoCardTile({ card, brandId, className }: PromoCardTileProps) {
  const openDepositCampaignModal = useDepositCampaignModalStore((state) => state.open);
  const [isLoadingDepositCampaign, setIsLoadingDepositCampaign] = useState(false);
  const hasCaption = Boolean(card.title || card.subtitle);
  const isChallenge = Boolean(card.betAndGetCampaignId || card.depositCampaignId);

  const content = (
    <>
      {/* Absolutely positioned (matching the static fallback PromoCard's
          own image) so the uploaded image's intrinsic aspect ratio never
          contributes real in-flow height to this card - left in normal
          flow, a tall/portrait upload would inflate this card's height
          and, via the mobile scroller's default flex align-items:stretch,
          drag Match of the Day's height up along with it even though
          neither card's own size should depend on the other's content. */}
      <img
        src={`/backend/public/promo-cards/${brandId}/item/${card.id}`}
        alt={card.title ?? ''}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {isChallenge && (
        <TrophyIcon
          width={22}
          height={22}
          className="absolute right-3 top-3 text-highlight drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
        />
      )}
      {hasCaption && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 text-white">
            {card.title && <p className="font-display text-lg leading-tight">{card.title}</p>}
            {card.subtitle && <p className="text-sm text-white/80">{card.subtitle}</p>}
          </div>
        </>
      )}
    </>
  );

  const frameClassName = isChallenge ? 'border-2 border-highlight' : '';

  if (card.betAndGetCampaignId) {
    return (
      <Link
        to={`/campaigns/${card.betAndGetCampaignId}`}
        className={`relative block overflow-hidden rounded-3xl ${frameClassName} ${className ?? ''}`}
      >
        {content}
      </Link>
    );
  }

  if (card.depositCampaignId) {
    const depositCampaignId = card.depositCampaignId;
    async function handleClick() {
      setIsLoadingDepositCampaign(true);
      try {
        const campaign = await backendApi.getDepositCampaign(brandId, depositCampaignId);
        openDepositCampaignModal(campaign);
      } catch {
        // Best-effort - a failed fetch just means the click did nothing.
      } finally {
        setIsLoadingDepositCampaign(false);
      }
    }

    return (
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isLoadingDepositCampaign}
        className={`relative block w-full overflow-hidden rounded-3xl text-left disabled:cursor-wait ${frameClassName} ${className ?? ''}`}
      >
        {content}
      </button>
    );
  }

  return <div className={`relative overflow-hidden rounded-3xl ${className ?? ''}`}>{content}</div>;
}

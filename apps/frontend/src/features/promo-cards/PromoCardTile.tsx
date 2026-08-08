import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrophyIcon } from '../../components/ui/NavIcons';
import * as backendApi from '../../lib/backendApi';
import type { PromoCardItem } from '../../lib/backendApi';
import { useContrastColor } from '../../lib/useContrastColor';
import { useDepositCampaignModalStore } from '../deposit-campaigns/depositCampaignModalStore';

export interface PromoCardTileProps {
  card: PromoCardItem;
  brandId: string;
  className?: string;
}

/**
 * One CMS-managed promo card, with an optional title/subtitle and an
 * optional click-through to its linked campaign - a Bet & Get campaign
 * navigates to its matches page, a deposit campaign reopens the same modal
 * the post-login trigger uses (see DepositCampaignModal), a leaderboard
 * navigates to its detail page. A register campaign has no browsable page
 * of its own (it's an automatic welcome bonus, not something to browse),
 * so it only contributes to the trophy badge below, never a click target.
 * A card with none of the 4 ids set is purely decorative (no link). See
 * apps/backend's PromoCardService and the backoffice's CMS Promo Cards page.
 *
 * `hasImage: false` (see PromoCardAutoSyncService) means a campaign went
 * live before staff uploaded any artwork for it - rendered as a short,
 * full-width brand-color banner instead of a photo, so the campaign is
 * still discoverable without a CMS step being a prerequisite. `EARLY_ENDED`
 * cards (endAt already passed) render grayscale - see ChallengesPage's
 * "Early ended" section.
 *
 * The bright highlight-colored ring and trophy corner badge mark this as a
 * "challenge" - decorative framing only, since neither campaign type has a
 * real progress field to render (no fabricated "won" state).
 */
export function PromoCardTile({ card, brandId, className }: PromoCardTileProps) {
  const openDepositCampaignModal = useDepositCampaignModalStore((state) => state.open);
  const [isLoadingDepositCampaign, setIsLoadingDepositCampaign] = useState(false);
  const brandContrast = useContrastColor('--color-brand');
  const hasCaption = Boolean(card.title || card.subtitle);
  const isChallenge = Boolean(
    card.betAndGetCampaignId || card.depositCampaignId || card.registerCampaignId || card.leaderboardCampaignId,
  );
  const isEarlyEnded = card.status === 'EARLY_ENDED';

  const content = card.hasImage ? (
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
  ) : (
    <div
      className="flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-0.5 px-4 py-3 text-center"
      style={{ backgroundColor: 'var(--color-brand)', color: brandContrast }}
    >
      {isChallenge && <TrophyIcon width={18} height={18} className="mb-0.5" style={{ color: brandContrast }} />}
      {card.title && <p className="font-display text-lg leading-tight">{card.title}</p>}
      {card.subtitle && <p className="text-sm opacity-85">{card.subtitle}</p>}
    </div>
  );

  const frameClassName = [
    isChallenge ? 'border-2 border-highlight' : '',
    isEarlyEnded ? 'grayscale' : '',
  ]
    .filter(Boolean)
    .join(' ');

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

  if (card.leaderboardCampaignId) {
    return (
      <Link
        to={`/leaderboards/${card.leaderboardCampaignId}`}
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

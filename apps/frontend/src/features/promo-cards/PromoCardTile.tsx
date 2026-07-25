import { Link } from 'react-router-dom';
import type { PromoCardItem } from '../../lib/backendApi';

export interface PromoCardTileProps {
  card: PromoCardItem;
  brandId: string;
  className?: string;
}

/**
 * One CMS-managed promo card image, with an optional title/subtitle scrim
 * and an optional click-through to its linked Bet & Get campaign - see
 * apps/backend's PromoCardService and the backoffice's CMS Promo Cards
 * page. A card with no betAndGetCampaignId is purely decorative (no link).
 */
export function PromoCardTile({ card, brandId, className }: PromoCardTileProps) {
  const hasCaption = Boolean(card.title || card.subtitle);

  const content = (
    <>
      <img
        src={`/backend/public/promo-cards/${brandId}/item/${card.id}`}
        alt={card.title ?? ''}
        className="h-full w-full object-cover"
      />
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

  if (card.betAndGetCampaignId) {
    return (
      <Link
        to={`/campaigns/${card.betAndGetCampaignId}`}
        className={`relative block overflow-hidden rounded-3xl ${className ?? ''}`}
      >
        {content}
      </Link>
    );
  }

  return <div className={`relative overflow-hidden rounded-3xl ${className ?? ''}`}>{content}</div>;
}

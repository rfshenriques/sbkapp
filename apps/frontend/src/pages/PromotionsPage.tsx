import { Card } from '../components/ui/Card';
import { useBrandStore } from '../features/brand/brandStore';
import { PromoCardTile } from '../features/promo-cards/PromoCardTile';
import { usePromoCards } from '../features/promo-cards/usePromoCards';

/**
 * Renders whatever CMS-managed promo cards the brand has set up (see the
 * backoffice's Promo Cards page) - honest "nothing yet" empty state when
 * there are none, rather than fabricated promo content.
 */
export default function PromotionsPage() {
  const { data: promoCards } = usePromoCards();
  const brandId = useBrandStore((state) => state.brandId);
  const hasCards = Boolean(promoCards && promoCards.length > 0 && brandId);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <h1 className="font-display text-lg">Promotions</h1>
      </div>

      {hasCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {promoCards!.map((card) => (
            <PromoCardTile key={card.id} card={card} brandId={brandId!} className="h-48" />
          ))}
        </div>
      ) : (
        <Card className="text-text-secondary">No active promotions right now - check back soon.</Card>
      )}
    </div>
  );
}

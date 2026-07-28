import { Card } from '../components/ui/Card';
import { TrophyIcon } from '../components/ui/NavIcons';
import { Skeleton } from '../components/ui/Skeleton';
import { useBrandStore } from '../features/brand/brandStore';
import { PromoCardTile } from '../features/promo-cards/PromoCardTile';
import { usePromoCards } from '../features/promo-cards/usePromoCards';

/**
 * Renders whatever CMS-managed promo cards the brand has set up (see the
 * backoffice's Promo Cards page) - honest "nothing yet" empty state when
 * there are none, rather than fabricated promo content. Each card is a
 * "challenge": a real Bet & Get or deposit campaign with a reward attached
 * (see PromoCardTile) - this page is just the full list of them.
 */
export default function ChallengesPage() {
  const { data: promoCards, isPending } = usePromoCards();
  const brandId = useBrandStore((state) => state.brandId);
  const hasCards = Boolean(promoCards && promoCards.length > 0 && brandId);

  // No-image cards (a campaign that went live before staff uploaded
  // artwork - see PromoCardTile) get their own short full-width row rather
  // than sitting in the 2-col image grid, which assumes a photo's aspect
  // ratio. Early-ended cards (real endAt already passed) move to their own
  // grayscale section below rather than disappearing outright.
  const activeCards = (promoCards ?? []).filter((card) => card.status === 'ACTIVE');
  const activeImaged = activeCards.filter((card) => card.hasImage);
  const activeNoImage = activeCards.filter((card) => !card.hasImage);
  const earlyEnded = (promoCards ?? []).filter((card) => card.status === 'EARLY_ENDED');

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <TrophyIcon width={22} height={22} />
        <h1 className="font-display text-lg">Challenges</h1>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Loading challenges" role="status">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : hasCards ? (
        <div className="space-y-4">
          {activeNoImage.map((card) => (
            <PromoCardTile key={card.id} card={card} brandId={brandId!} />
          ))}

          {activeImaged.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {activeImaged.map((card) => (
                <PromoCardTile key={card.id} card={card} brandId={brandId!} className="h-48" />
              ))}
            </div>
          )}

          {earlyEnded.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold tracking-wide text-text-muted uppercase">Early ended</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {earlyEnded.map((card) => (
                  <PromoCardTile
                    key={card.id}
                    card={card}
                    brandId={brandId!}
                    className={card.hasImage ? 'h-48' : ''}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card className="text-text-secondary">No active challenges right now - check back soon.</Card>
      )}
    </div>
  );
}

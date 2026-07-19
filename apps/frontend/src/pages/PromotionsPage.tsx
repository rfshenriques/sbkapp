import { Card } from '../components/ui/Card';

/**
 * Promotions are reachable from the nav so players can find the section,
 * but there's no promotions/bonus data to show yet (apps/backend's
 * PromotionsBonusModule is still an empty placeholder - see
 * docs/PROJECT_BRIEF.md Phase 5). An honest "nothing yet" state here, not
 * fabricated promo content.
 */
export default function PromotionsPage() {
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

      <Card className="text-text-secondary">No active promotions right now - check back soon.</Card>
    </div>
  );
}

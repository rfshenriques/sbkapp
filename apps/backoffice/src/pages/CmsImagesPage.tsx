import { PromoImageSlots } from '../features/cms/PromoImageSlots';

export default function CmsImagesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">CMS: Images</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Upload the promo images used across the player-facing app. PNG, JPEG, or WebP, up to 5MB.
      </p>

      <div className="mt-4">
        <PromoImageSlots />
      </div>
    </div>
  );
}

import { useState, type ReactNode } from 'react';

export type BrandImageSlot = 'REGISTER_DESKTOP' | 'REGISTER_MOBILE' | 'HOMEPAGE_OFFER';

export interface BrandPromoImageProps {
  brandId: string | undefined;
  slot: BrandImageSlot;
  className?: string;
  /** Rendered instead whenever the brand hasn't uploaded an image for this slot yet (or it fails to load) - see the backoffice's CMS images page. */
  fallback: ReactNode;
}

/**
 * A staff-uploaded CMS image (see apps/backend's BrandImagesModule), or the
 * caller's own fallback content when none is set - there's no public
 * "does this exist" endpoint, so this just requests the image and lets
 * onError signal "not configured" rather than showing a broken image icon.
 */
export function BrandPromoImage({ brandId, slot, className, fallback }: BrandPromoImageProps) {
  const [failed, setFailed] = useState(false);

  if (!brandId || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={`/backend/public/brand-images/${brandId}/${slot}`}
      alt=""
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

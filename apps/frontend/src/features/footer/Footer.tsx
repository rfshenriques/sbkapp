import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getPublicBrand, type BrandImageListItem } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';
import { useBrandImageList } from './useBrandImageList';

function ImageListRow({
  brandId,
  items,
  alt,
}: {
  brandId: string;
  items: BrandImageListItem[];
  alt: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <img
          key={item.id}
          src={`/backend/public/brand-image-list/${brandId}/item/${item.id}`}
          alt={alt}
          className="h-8 w-auto object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0"
        />
      ))}
    </div>
  );
}

/**
 * Sponsor logos, payment method icons, useful links, and a Responsible
 * Gambling note - only sections backed by real data render. No download-
 * app buttons (no native app exists) and no fabricated support contact -
 * see apps/backend's Brand.supportHelplineText.
 */
export function Footer() {
  const brandId = useBrandStore((state) => state.brandId);
  // Shares apps/frontend's existing ['public-brand', hostname] cache
  // entry (see useBrandTheme, already fetched once per app load by
  // AppShell) rather than re-requesting it.
  const { data: brand } = useQuery({
    queryKey: ['public-brand', typeof window === 'undefined' ? '' : window.location.hostname],
    queryFn: getPublicBrand,
    staleTime: Infinity,
  });

  const sponsorLogos = useBrandImageList('SPONSOR_LOGO');
  const paymentMethods = useBrandImageList('PAYMENT_METHOD');

  const hasSponsorLogos = Boolean(sponsorLogos.data && sponsorLogos.data.length > 0);
  const hasPaymentMethods = Boolean(paymentMethods.data && paymentMethods.data.length > 0);

  return (
    <footer className="mt-8 border-t border-border">
      <div className="mx-auto max-w-[1680px] space-y-6 px-4 py-8">
        {hasSponsorLogos && brandId && (
          <div>
            <p className="mb-3 text-xs font-bold tracking-wide text-text-muted uppercase">Sponsors</p>
            <ImageListRow brandId={brandId} items={sponsorLogos.data!} alt="Sponsor" />
          </div>
        )}

        {hasPaymentMethods && brandId && (
          <div>
            <p className="mb-3 text-xs font-bold tracking-wide text-text-muted uppercase">
              Payment methods
            </p>
            <ImageListRow brandId={brandId} items={paymentMethods.data!} alt="Payment method" />
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-start sm:justify-between">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary" aria-label="Footer">
            <Link to="/challenges" className="hover:text-text-primary">
              Challenges
            </Link>
            <Link to="/live" className="hover:text-text-primary">
              Live
            </Link>
            <Link to="/responsible-gambling" className="hover:text-text-primary">
              Responsible Gambling
            </Link>
          </nav>

          <div className="max-w-md text-xs text-text-muted">
            <p>18+ Play responsibly. Gambling can be addictive.</p>
            {brand?.supportHelplineText && <p className="mt-1">{brand.supportHelplineText}</p>}
          </div>
        </div>

        <p className="text-xs text-text-muted">
          © {new Date().getFullYear()} {brand?.name ?? 'Sportsbook'}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

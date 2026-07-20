import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandPromoImage } from './BrandPromoImage';

// alt="" is intentional (purely decorative background image), which means
// it has ARIA role "presentation", not "img" - query it that way rather
// than fighting the (correct) accessibility semantics.
describe('BrandPromoImage', () => {
  it('renders the image pointed at the given brand + slot when a brandId is known', () => {
    const { container } = render(
      <BrandPromoImage brandId="brand-1" slot="HOMEPAGE_OFFER" fallback={<p>Fallback</p>} />,
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/backend/public/brand-images/brand-1/HOMEPAGE_OFFER');
    expect(screen.queryByText('Fallback')).not.toBeInTheDocument();
  });

  it('renders the fallback when brandId is not known yet', () => {
    const { container } = render(
      <BrandPromoImage brandId={undefined} slot="HOMEPAGE_OFFER" fallback={<p>Fallback</p>} />,
    );

    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('falls back to the caller-provided content when the image fails to load', () => {
    const { container } = render(
      <BrandPromoImage brandId="brand-1" slot="REGISTER_DESKTOP" fallback={<p>Fallback</p>} />,
    );

    fireEvent.error(container.querySelector('img')!);

    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });
});

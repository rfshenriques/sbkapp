import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PromotionsPage from './PromotionsPage';

describe('PromotionsPage', () => {
  it('shows an honest empty state rather than fabricated promo content', () => {
    render(<PromotionsPage />);

    expect(screen.getByRole('heading', { name: 'Promotions' })).toBeInTheDocument();
    expect(screen.getByText(/No active promotions right now/)).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BalancePills } from './BalancePills';

describe('BalancePills', () => {
  it('formats each balance with the smart-decimal rule and shows both pills', () => {
    render(<BalancePills cashCents={123_456_00} freebetsCents={4_300} />);

    expect(screen.getByTitle('Cash balance (paper)')).toHaveTextContent('123456 €');
    expect(screen.getByTitle('Freebets balance')).toHaveTextContent('43 €');
  });

  it('never lets a pill shrink or wrap - what was actually causing the digits to collide with a large cash balance', () => {
    render(<BalancePills cashCents={123_456_00} freebetsCents={4_300} />);

    expect(screen.getByTitle('Cash balance (paper)')).toHaveClass('shrink-0', 'whitespace-nowrap');
    expect(screen.getByTitle('Freebets balance')).toHaveClass('shrink-0', 'whitespace-nowrap');
  });

  it('hides the freebets pill entirely at a zero balance', () => {
    render(<BalancePills cashCents={1_000} freebetsCents={0} />);

    expect(screen.queryByTitle('Freebets balance')).not.toBeInTheDocument();
  });

  it('shows the wallet glyph in the cash pill by default', () => {
    render(<BalancePills cashCents={1_000} freebetsCents={0} />);

    expect(screen.getByTitle('Cash balance (paper)').querySelector('svg')).toBeInTheDocument();
  });

  it('omits the wallet glyph when hideCashIcon is set - the header uses this so a large balance never crowds the account menu button to the side', () => {
    render(<BalancePills cashCents={1_000} freebetsCents={0} hideCashIcon />);

    expect(screen.getByTitle('Cash balance (paper)').querySelector('svg')).not.toBeInTheDocument();
  });
});

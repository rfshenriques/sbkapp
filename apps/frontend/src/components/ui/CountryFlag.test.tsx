import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CountryFlag } from './CountryFlag';

describe('CountryFlag', () => {
  it('renders drawn full-bleed SVG artwork for a real, mapped country', () => {
    const { container } = render(<CountryFlag country="England" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32');
  });

  it('falls back to the globe image for a non-country grouping like World', () => {
    render(<CountryFlag country="World" />);
    const badge = screen.getByRole('img', { name: 'World' });
    expect(badge.querySelector('img')).toBeInTheDocument();
  });

  it('falls back to the globe image for an unmapped country without crashing', () => {
    render(<CountryFlag country="Atlantis" />);
    const badge = screen.getByRole('img', { name: 'Atlantis' });
    expect(badge.querySelector('img')).toBeInTheDocument();
  });
});

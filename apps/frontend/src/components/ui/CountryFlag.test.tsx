import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CountryFlag } from './CountryFlag';

describe('CountryFlag', () => {
  it('renders full-bleed circular SVG artwork, not emoji text', () => {
    const { container } = render(<CountryFlag country="England" />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32');
  });

  it('falls back to a neutral globe for a non-country grouping like World, without crashing', () => {
    const { container } = render(<CountryFlag country="World" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SportIcon } from './SportIcon';

describe('SportIcon', () => {
  it('renders the provided icon image for a sport with a matching asset, like Football', () => {
    render(<SportIcon sport="Football" />);
    const badge = screen.getByRole('img', { name: 'Football' });
    const img = badge.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src');
  });

  it('renders the same fist icon for Boxing as MMA (fighting sports share one icon for now)', () => {
    render(<SportIcon sport="Boxing" />);
    const mmaBadge = document.createElement('div');
    render(<SportIcon sport="MMA" />, { container: mmaBadge });

    const boxingImg = screen.getByRole('img', { name: 'Boxing' }).querySelector('img');
    const mmaImg = mmaBadge.querySelector('img');
    expect(boxingImg?.getAttribute('src')).toBe(mmaImg?.getAttribute('src'));
  });

  it('renders hand-drawn full-bleed SVG artwork for a sport with no matching image, like Ice Hockey', () => {
    const { container } = render(<SportIcon sport="Ice Hockey" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32');
  });

  it('falls back to the generic hand-drawn glyph for an unmapped sport without crashing', () => {
    const { container } = render(<SportIcon sport="Curling" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SportIcon } from './SportIcon';

describe('SportIcon', () => {
  it('renders the real platform emoji for a round-ball sport like Football', () => {
    render(<SportIcon sport="Football" />);
    expect(screen.getByRole('img', { name: 'Football' })).toHaveTextContent('⚽');
  });

  it('renders hand-drawn full-bleed SVG artwork for a non-round sport like Boxing', () => {
    const { container } = render(<SportIcon sport="Boxing" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32');
  });

  it('falls back to the generic hand-drawn glyph for an unmapped sport without crashing', () => {
    const { container } = render(<SportIcon sport="Curling" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

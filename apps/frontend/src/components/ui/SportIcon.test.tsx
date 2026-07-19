import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SportIcon } from './SportIcon';

describe('SportIcon', () => {
  it('renders full-bleed circular SVG artwork, not emoji text', () => {
    const { container } = render(<SportIcon sport="Football" />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32');
  });

  it('falls back to the generic glyph for an unmapped sport without crashing', () => {
    const { container } = render(<SportIcon sport="Curling" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

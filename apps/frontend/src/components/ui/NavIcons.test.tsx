import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeIcon, LiveIcon, MyBetsIcon, PromotionsIcon, SearchIcon } from './NavIcons';

describe('NavIcons', () => {
  it.each([
    ['SearchIcon', SearchIcon],
    ['HomeIcon', HomeIcon],
    ['LiveIcon', LiveIcon],
    ['MyBetsIcon', MyBetsIcon],
    ['PromotionsIcon', PromotionsIcon],
  ])('renders %s as an svg using currentColor so it inherits text color', (_name, Icon) => {
    const { container } = render(<Icon data-testid="icon" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });
});

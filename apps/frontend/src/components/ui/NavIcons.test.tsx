import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FireIcon, LiveIcon, MyBetsIcon, SearchIcon, TrophyIcon } from './NavIcons';

describe('NavIcons', () => {
  it.each([
    ['SearchIcon', SearchIcon],
    ['FireIcon', FireIcon],
    ['LiveIcon', LiveIcon],
    ['MyBetsIcon', MyBetsIcon],
  ])('renders %s as an svg using currentColor stroke so it inherits text color', (_name, Icon) => {
    const { container } = render(<Icon data-testid="icon" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });

  it('renders TrophyIcon as a solid svg filled with currentColor', () => {
    const { container } = render(<TrophyIcon data-testid="icon" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('fill', 'currentColor');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SportCountryBadge } from './SportCountryBadge';

describe('SportCountryBadge', () => {
  it('renders the sport icon before the country flag in the DOM', () => {
    render(<SportCountryBadge sport="Football" country="England" />);

    const icons = screen.getAllByRole('img');
    expect(icons).toHaveLength(2);
    expect(icons[0]).toHaveAccessibleName('Football');
    expect(icons[1]).toHaveAccessibleName('England');
  });

  it('positions the flag overlapping the sport icon by 30% of the icon size', () => {
    render(<SportCountryBadge sport="Football" country="England" size={20} />);

    const flag = screen.getByRole('img', { name: 'England' });
    // 30% of 20px = 6px overlap, so the flag starts at 20 - 6 = 14px.
    expect(flag).toHaveStyle({ left: '14px' });
  });
});

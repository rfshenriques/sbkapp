import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TOP_NAV_ICON_KEYS } from '@sportsbook/shared';
import { TopNavIcon } from './TopNavIcon';

describe('TopNavIcon', () => {
  it('renders every icon in the shared set without throwing', () => {
    for (const icon of TOP_NAV_ICON_KEYS) {
      const { container, unmount } = render(<TopNavIcon icon={icon} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.children.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('forwards width/height props onto the svg element', () => {
    const { container } = render(<TopNavIcon icon="STAR" width={18} height={18} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('height', '18');
  });
});

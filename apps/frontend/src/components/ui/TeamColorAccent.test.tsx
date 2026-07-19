import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamColorAccent } from './TeamColorAccent';

describe('TeamColorAccent', () => {
  it('renders nothing when no color is known for the team', () => {
    const { container } = render(<TeamColorAccent colorHex={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a colored marker when a color is known', () => {
    const { container } = render(<TeamColorAccent colorHex="#EF0107" />);
    const marker = container.firstElementChild as HTMLElement;
    expect(marker).toHaveStyle({ backgroundColor: '#EF0107' });
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Match card content</Card>);

    expect(screen.getByText('Match card content')).toBeInTheDocument();
  });

  it('merges a custom className with its base styles', () => {
    render(<Card className="custom-class">content</Card>);

    const card = screen.getByText('content');
    expect(card.className).toContain('custom-class');
    expect(card.className).toContain('rounded-2xl');
  });
});

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label and responds to clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Place bet</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Place bet' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Place bet
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Place bet' }));

    expect(onClick).not.toHaveBeenCalled();
  });
});

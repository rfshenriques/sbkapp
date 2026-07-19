import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ErrorPage from './ErrorPage';

describe('ErrorPage', () => {
  it('shows a reassuring message with no stack trace, plus a reload button and a home link', () => {
    render(
      <MemoryRouter>
        <ErrorPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading')).toHaveTextContent("Well, that didn't go to plan");
    expect(screen.getByText(/Your wallet and bets are safe/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});

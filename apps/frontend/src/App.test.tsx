import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the phase 0 shell and reports the shared event contract count', () => {
    render(<App />);

    expect(screen.getByText('Sportsbook — Phase 0 shell')).toBeInTheDocument();
    expect(screen.getByText(/8 events defined/)).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ResponsibleGamblingPage from './ResponsibleGamblingPage';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ResponsibleGamblingPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResponsibleGamblingPage', () => {
  it('shows the age restriction and self-exclusion info, with a generic support note when no helpline is configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    renderPage();

    expect(screen.getByRole('heading', { name: 'Responsible Gambling' })).toBeInTheDocument();
    expect(screen.getByText(/at least 18 years old/)).toBeInTheDocument();
    expect(await screen.findByText(/Contact support for guidance/)).toBeInTheDocument();
  });

  it('shows the brand-configured helpline text instead of the generic note when one is set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'brand-1',
            name: 'Test Brand',
            logoUrl: null,
            themeMode: 'DARK',
            buttonColorHex: null,
            highlightColorHex: null,
            filterColorHex: null,
            supportHelplineText: 'Call 1-800-SUPPORT for help.',
          }),
          { status: 200 },
        ),
      ),
    );

    renderPage();

    expect(await screen.findByText('Call 1-800-SUPPORT for help.')).toBeInTheDocument();
    expect(screen.queryByText(/Contact support for guidance/)).not.toBeInTheDocument();
  });
});

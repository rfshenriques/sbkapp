import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabletBetSlipDrawer } from './TabletBetSlipDrawer';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

function renderDrawer(onClose: () => void = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TabletBetSlipDrawer onClose={onClose} closeLabel="Close bet slip" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TabletBetSlipDrawer', () => {
  it('renders nothing when the viewport is outside the tablet width range', () => {
    stubMatchMedia(false);
    const { container } = renderDrawer();

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the floating right-edge panel when the viewport is within the tablet width range', async () => {
    stubMatchMedia(true);
    renderDrawer();

    expect(await screen.findByRole('heading', { name: 'Bet Slip' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Close bet slip' }).length).toBeGreaterThan(0);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    stubMatchMedia(true);
    const onClose = vi.fn();
    renderDrawer(onClose);

    await screen.findByRole('heading', { name: 'Bet Slip' });
    const [backdrop] = screen.getAllByRole('button', { name: 'Close bet slip' });
    await userEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalled();
  });
});

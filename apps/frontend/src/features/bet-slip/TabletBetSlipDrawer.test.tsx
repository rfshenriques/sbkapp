import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabletBetSlipDrawer } from './TabletBetSlipDrawer';

/** Real tablet tier: at least 640px wide, but a coarse/no-hover (touch) pointer, never a real mouse. */
function stubTabletTier() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(min-width: 640px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function stubMobileWidth() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

/** A real desktop browser, regardless of window width - mouse + hover support. */
function stubDesktopPointer() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
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
  it('renders nothing on a narrow (phone-width) viewport', () => {
    stubMobileWidth();
    const { container } = renderDrawer();

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on a real desktop browser, even a wide/landscape one - hover+fine-pointer wins over width', () => {
    stubDesktopPointer();
    const { container } = renderDrawer();

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the floating right-edge panel on a touch tablet, regardless of exact width', async () => {
    stubTabletTier();
    renderDrawer();

    expect(await screen.findByRole('heading', { name: 'Bet Slip' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Close bet slip' }).length).toBeGreaterThan(0);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    stubTabletTier();
    const onClose = vi.fn();
    renderDrawer(onClose);

    await screen.findByRole('heading', { name: 'Bet Slip' });
    const [backdrop] = screen.getAllByRole('button', { name: 'Close bet slip' });
    await userEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalled();
  });
});

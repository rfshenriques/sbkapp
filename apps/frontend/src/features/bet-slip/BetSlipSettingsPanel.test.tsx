import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import { BetSlipSettingsPanel } from './BetSlipSettingsPanel';
import { useBetSlipSettingsStore } from './betSlipSettingsStore';

function renderPanel(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <BetSlipSettingsPanel onClose={onClose} />
    </QueryClientProvider>,
  );
  return { ...utils, onClose };
}

function stubFetch(patchResponse: { autoUpdateOdds: boolean; quickStakeCents: number[] }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    if (url === '/backend/bet-slip-settings' && method === 'GET') {
      return new Response(JSON.stringify({ autoUpdateOdds: false, quickStakeCents: [500, 1000, 2500, 5000] }), {
        status: 200,
      });
    }
    if (url === '/backend/bet-slip-settings' && method === 'PATCH') {
      return new Response(JSON.stringify(patchResponse), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
  useBetSlipSettingsStore.setState({
    autoUpdateOdds: false,
    quickStakes: [5, 10, 25, 50],
  });
});

describe('BetSlipSettingsPanel', () => {
  it('calls onClose when the close button is clicked', async () => {
    stubFetch({ autoUpdateOdds: false, quickStakeCents: [500, 1000, 2500, 5000] });
    const { onClose } = renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Close bet slip settings' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('toggles and persists auto-update-odds immediately, without waiting for the request', async () => {
    const fetchMock = stubFetch({ autoUpdateOdds: true, quickStakeCents: [5, 10, 25, 50].map((v) => v * 100) });
    renderPanel();

    const toggle = screen.getByRole('switch', { name: 'Auto-accept updated odds' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(useBetSlipSettingsStore.getState().autoUpdateOdds).toBe(true);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/backend/bet-slip-settings',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ autoUpdateOdds: true }) }),
      ),
    );
  });

  it('saves edited quick stakes, persists them, and closes the panel', async () => {
    const fetchMock = stubFetch({ autoUpdateOdds: false, quickStakeCents: [250, 1000, 2500, 5000] });
    const { onClose } = renderPanel();

    const firstStake = screen.getByLabelText('Quick stake 1');
    await userEvent.clear(firstStake);
    await userEvent.type(firstStake, '2.5');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(useBetSlipSettingsStore.getState().quickStakes).toEqual([2.5, 10, 25, 50]);
    expect(onClose).toHaveBeenCalled();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/backend/bet-slip-settings',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ quickStakeCents: [250, 1000, 2500, 5000] }),
        }),
      ),
    );
  });

  it('does not collapse a trailing decimal point while typing (2.5 must not render as 25)', async () => {
    stubFetch({ autoUpdateOdds: false, quickStakeCents: [500, 1000, 2500, 5000] });
    renderPanel();

    const firstStake = screen.getByLabelText('Quick stake 1') as HTMLInputElement;
    await userEvent.clear(firstStake);
    await userEvent.type(firstStake, '2.');

    expect(firstStake.value).toBe('2.');
  });

  it('disables Save and does not persist when a quick stake is invalid', async () => {
    const fetchMock = stubFetch({ autoUpdateOdds: false, quickStakeCents: [500, 1000, 2500, 5000] });
    const { onClose } = renderPanel();

    const firstStake = screen.getByLabelText('Quick stake 1');
    await userEvent.clear(firstStake);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    const storedBefore = useBetSlipSettingsStore.getState().quickStakes;
    expect(useBetSlipSettingsStore.getState().quickStakes).toEqual(storedBefore);
    expect(onClose).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'PATCH')).toBe(
      true,
    );
  });
});

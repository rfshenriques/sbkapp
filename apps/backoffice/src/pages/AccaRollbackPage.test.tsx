import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { AccaRollbackConfig } from '../lib/backendApi';
import AccaRollbackPage from './AccaRollbackPage';

function renderAccaRollbackPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AccaRollbackPage />
    </QueryClientProvider>,
  );
}

function stubFetch(config: AccaRollbackConfig) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/backend/admin/acca-rollback-config') {
      return new Response(JSON.stringify(config), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'trader_bob', role: 'TRADING' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccaRollbackPage', () => {
  it('loads and shows the current config', async () => {
    stubFetch({ minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: false });
    renderAccaRollbackPage();

    expect(await screen.findByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).not.toBeChecked();
  });

  it('saves the edited config with a PUT', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/acca-rollback-config') {
        return new Response(
          JSON.stringify({ minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: false }),
          { status: 200 },
        );
      }
      if (method === 'PUT' && url === '/backend/admin/acca-rollback-config') {
        expect(JSON.parse(init!.body as string)).toEqual({
          minSelections: 3,
          lossThreshold: 2,
          rewardPercent: 100,
          enabled: true,
        });
        return new Response(
          JSON.stringify({ minSelections: 3, lossThreshold: 2, rewardPercent: 100, enabled: true }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderAccaRollbackPage();
    const lossThresholdInput = await screen.findByLabelText('Loss threshold (legs)');
    await userEvent.clear(lossThresholdInput);
    await userEvent.type(lossThresholdInput, '2');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('checkbox', { name: 'Enabled' })).toBeChecked();
  });
});

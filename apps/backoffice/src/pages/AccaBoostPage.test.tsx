import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { AccaBoostConfig } from '../lib/backendApi';
import AccaBoostPage from './AccaBoostPage';

function renderAccaBoostPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AccaBoostPage />
    </QueryClientProvider>,
  );
}

function stubFetch(config: AccaBoostConfig) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/backend/admin/acca-boost-config') {
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

describe('AccaBoostPage', () => {
  it('loads and shows the current config', async () => {
    stubFetch({ boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: false });
    renderAccaBoostPage();

    expect(await screen.findByDisplayValue('5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.2')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).not.toBeChecked();
  });

  it('saves the edited config with a PUT', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/acca-boost-config') {
        return new Response(
          JSON.stringify({ boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: false }),
          { status: 200 },
        );
      }
      if (method === 'PUT' && url === '/backend/admin/acca-boost-config') {
        expect(JSON.parse(init!.body as string)).toEqual({
          boostPercentPerLeg: 7,
          minSelections: 3,
          minOddsPerLeg: 1.2,
          enabled: true,
        });
        return new Response(
          JSON.stringify({ boostPercentPerLeg: 7, minSelections: 3, minOddsPerLeg: 1.2, enabled: true }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderAccaBoostPage();
    const boostInput = await screen.findByLabelText('Boost % per leg');
    await userEvent.clear(boostInput);
    await userEvent.type(boostInput, '7');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('checkbox', { name: 'Enabled' })).toBeChecked();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { InsuranceBetConfig } from '../lib/backendApi';
import InsuranceBetPage from './InsuranceBetPage';

function renderInsuranceBetPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <InsuranceBetPage />
    </QueryClientProvider>,
  );
}

function stubFetch(config: InsuranceBetConfig) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/backend/admin/insurance-bet-config') {
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

describe('InsuranceBetPage', () => {
  it('loads and shows the current config', async () => {
    stubFetch({ costPercent: 10, enabled: false, minOdds: 1.5 });
    renderInsuranceBetPage();

    expect(await screen.findByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).not.toBeChecked();
  });

  it('saves the edited config with a PUT', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/insurance-bet-config') {
        return new Response(JSON.stringify({ costPercent: 10, enabled: false, minOdds: 1 }), { status: 200 });
      }
      if (method === 'PUT' && url === '/backend/admin/insurance-bet-config') {
        expect(JSON.parse(init!.body as string)).toEqual({ costPercent: 15, enabled: true, minOdds: 1 });
        return new Response(JSON.stringify({ costPercent: 15, enabled: true, minOdds: 1 }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderInsuranceBetPage();
    const costPercentInput = await screen.findByLabelText('Cost %');
    await userEvent.clear(costPercentInput);
    await userEvent.type(costPercentInput, '15');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('checkbox', { name: 'Enabled' })).toBeChecked();
  });

  it('saves an edited minimum odds floor', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/insurance-bet-config') {
        return new Response(JSON.stringify({ costPercent: 10, enabled: true, minOdds: 1 }), { status: 200 });
      }
      if (method === 'PUT' && url === '/backend/admin/insurance-bet-config') {
        expect(JSON.parse(init!.body as string)).toEqual({ costPercent: 10, enabled: true, minOdds: 2.5 });
        return new Response(JSON.stringify({ costPercent: 10, enabled: true, minOdds: 2.5 }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderInsuranceBetPage();
    const minOddsInput = await screen.findByLabelText('Minimum combined odds');
    await userEvent.clear(minOddsInput);
    await userEvent.type(minOddsInput, '2.5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByDisplayValue('2.5')).toBeInTheDocument();
  });
});

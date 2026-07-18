import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogEntry } from '../lib/backendApi';
import AuditLogPage from './AuditLogPage';

const settlementEntry: AuditLogEntry = {
  id: 'audit-1',
  actorStaffUserId: 'staff-1',
  actorUsername: 'trader_bob',
  action: 'SELECTION_SETTLED',
  targetType: 'BetSelection',
  targetId: 'sel-1',
  metadata: { betId: 'bet-1', previousStatus: 'OPEN', newStatus: 'WON' },
  createdAt: '2026-07-18T00:05:00Z',
};

function renderAuditLogPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuditLogPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AuditLogPage', () => {
  it('lists audit entries with actor, action, and metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([settlementEntry]), { status: 200 })),
    );

    renderAuditLogPage();

    expect(await screen.findByText('trader_bob')).toBeInTheDocument();
    expect(screen.getByText('SELECTION_SETTLED')).toBeInTheDocument();
    expect(screen.getByText(/BetSelection sel-1/)).toBeInTheDocument();
    expect(screen.getByText(/previousStatus: OPEN/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
    );

    renderAuditLogPage();

    expect(await screen.findByText('No audit entries yet.')).toBeInTheDocument();
  });
});

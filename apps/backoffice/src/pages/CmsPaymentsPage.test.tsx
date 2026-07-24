import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { BrandImageListItem } from '../lib/backendApi';
import CmsPaymentsPage from './CmsPaymentsPage';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CmsPaymentsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'cms_alice', role: 'CMS' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CmsPaymentsPage', () => {
  it('fetches and lists the PAYMENT_METHOD image list', async () => {
    const items: BrandImageListItem[] = [
      { id: 'pay-1', brandId: 'brand-1', kind: 'PAYMENT_METHOD', mimeType: 'image/svg+xml', sortOrder: 0, createdAt: 'x', updatedAt: 'x' },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/admin/brand-image-list?kind=PAYMENT_METHOD') {
          return new Response(JSON.stringify(items), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    renderPage();

    expect(await screen.findByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.getByLabelText('Upload image for payment methods')).toBeInTheDocument();
  });

  it('shows an honest empty state before anything is uploaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/admin/brand-image-list?kind=PAYMENT_METHOD') {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    renderPage();

    expect(await screen.findByText('Nothing uploaded yet.')).toBeInTheDocument();
  });
});

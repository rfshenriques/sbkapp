import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { BrandImageListItem } from '../lib/backendApi';
import CmsSponsorsPage from './CmsSponsorsPage';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CmsSponsorsPage />
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

describe('CmsSponsorsPage', () => {
  it('shows an honest empty state before anything is uploaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/admin/brand-image-list?kind=SPONSOR_LOGO') {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    renderPage();

    expect(await screen.findByText('Nothing uploaded yet.')).toBeInTheDocument();
  });

  it('lists sponsor logo items in sortOrder and removes one on click', async () => {
    const items: BrandImageListItem[] = [
      { id: 'logo-2', brandId: 'brand-1', kind: 'SPONSOR_LOGO', mimeType: 'image/png', sortOrder: 1, createdAt: 'x', updatedAt: 'x' },
      { id: 'logo-1', brandId: 'brand-1', kind: 'SPONSOR_LOGO', mimeType: 'image/png', sortOrder: 0, createdAt: 'x', updatedAt: 'x' },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url === '/backend/admin/brand-image-list?kind=SPONSOR_LOGO') {
        return new Response(JSON.stringify(items), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/brand-image-list/logo-1') {
        return new Response(JSON.stringify(items[1]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    const removeButtons = await screen.findAllByRole('button', { name: 'Remove' });
    expect(removeButtons).toHaveLength(2);

    await userEvent.click(removeButtons[0]!);

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/brand-image-list/logo-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('uploading a sponsor logo posts it as multipart form data to the SPONSOR_LOGO kind', async () => {
    let uploaded: BrandImageListItem | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url === '/backend/admin/brand-image-list?kind=SPONSOR_LOGO') {
        return new Response(JSON.stringify(uploaded ? [uploaded] : []), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/brand-image-list/SPONSOR_LOGO') {
        expect(init!.body).toBeInstanceOf(FormData);
        const file = (init!.body as FormData).get('file') as File;
        expect(file.name).toBe('sponsor.png');
        uploaded = {
          id: 'logo-1',
          brandId: 'brand-1',
          kind: 'SPONSOR_LOGO',
          mimeType: 'image/png',
          sortOrder: 0,
          createdAt: 'x',
          updatedAt: 'x',
        };
        return new Response(JSON.stringify(uploaded), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('Nothing uploaded yet.');

    const file = new File(['fake-bytes'], 'sponsor.png', { type: 'image/png' });
    const input = screen.getByLabelText('Upload image for sponsor logos');
    await userEvent.upload(input, file);

    await screen.findByRole('button', { name: 'Remove' });
  });
});

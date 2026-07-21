import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { BrandImage, BrandImageListItem } from '../lib/backendApi';
import CmsImagesPage from './CmsImagesPage';

const homepageOfferImage: BrandImage = {
  id: 'image-1',
  brandId: 'brand-1',
  slot: 'HOMEPAGE_OFFER',
  mimeType: 'image/png',
  createdAt: '2026-07-20T00:00:00Z',
  updatedAt: '2026-07-20T00:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CmsImagesPage />
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

describe('CmsImagesPage', () => {
  it('lists all three slots, each with its recommended resolution, and a preview only where an image is set', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/backend/admin/brand-images') {
        return new Response(JSON.stringify([homepageOfferImage]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Register - desktop')).toBeInTheDocument();
    expect(screen.getByText('Register - mobile')).toBeInTheDocument();
    expect(screen.getByText('Homepage offer')).toBeInTheDocument();
    expect(screen.getByText('Match of the day background')).toBeInTheDocument();
    expect(screen.getByText('Recommended: 800 × 1000px (4:5, portrait)')).toBeInTheDocument();

    // Only the slot with an image gets a preview + "Replace"/"Remove"; the rest show "Upload".
    expect(screen.getByRole('img', { name: 'Homepage offer preview' })).toHaveAttribute(
      'src',
      '/backend/public/brand-images/brand-1/HOMEPAGE_OFFER?v=2026-07-20T00%3A00%3A00Z',
    );
    expect(screen.getAllByRole('button', { name: 'Upload' })).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('uploading a file for an empty slot posts it as multipart form data', async () => {
    let uploaded: BrandImage | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/brand-images') {
        return new Response(JSON.stringify(uploaded ? [uploaded] : []), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/brand-images/REGISTER_DESKTOP') {
        expect(init!.body).toBeInstanceOf(FormData);
        const file = (init!.body as FormData).get('file') as File;
        expect(file.name).toBe('promo.png');
        uploaded = {
          id: 'image-2',
          brandId: 'brand-1',
          slot: 'REGISTER_DESKTOP',
          mimeType: 'image/png',
          createdAt: '2026-07-20T00:00:00Z',
          updatedAt: '2026-07-20T00:00:00Z',
        };
        return new Response(JSON.stringify(uploaded), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('Register - desktop');

    const file = new File(['fake-bytes'], 'promo.png', { type: 'image/png' });
    const input = screen.getByLabelText('Upload Register - desktop image');
    await userEvent.upload(input, file);

    expect(await screen.findByRole('img', { name: 'Register - desktop preview' })).toBeInTheDocument();
  });

  it('removing an image sends a delete for its slot', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/brand-images') {
        return new Response(JSON.stringify([homepageOfferImage]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/brand-images/HOMEPAGE_OFFER') {
        return new Response(JSON.stringify(homepageOfferImage), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('Homepage offer');

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/brand-images/HOMEPAGE_OFFER',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('switches to the Sponsor logos tab and lists items, with an honest empty state before anything is uploaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/admin/brand-images') return new Response(JSON.stringify([]), { status: 200 });
        if (url === '/backend/admin/brand-image-list?kind=SPONSOR_LOGO') {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    renderPage();
    await screen.findByText('Register - desktop');

    await userEvent.click(screen.getByRole('button', { name: 'Sponsor logos' }));

    expect(await screen.findByText('Nothing uploaded yet.')).toBeInTheDocument();
    expect(screen.queryByText('Register - desktop')).not.toBeInTheDocument();
  });

  it('lists sponsor logo items in sortOrder and removes one on click', async () => {
    const items: BrandImageListItem[] = [
      { id: 'logo-2', brandId: 'brand-1', kind: 'SPONSOR_LOGO', mimeType: 'image/png', sortOrder: 1, createdAt: 'x', updatedAt: 'x' },
      { id: 'logo-1', brandId: 'brand-1', kind: 'SPONSOR_LOGO', mimeType: 'image/png', sortOrder: 0, createdAt: 'x', updatedAt: 'x' },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (url === '/backend/admin/brand-images') return new Response(JSON.stringify([]), { status: 200 });
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
    await screen.findByText('Register - desktop');
    await userEvent.click(screen.getByRole('button', { name: 'Sponsor logos' }));

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
      if (url === '/backend/admin/brand-images') return new Response(JSON.stringify([]), { status: 200 });
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
    await screen.findByText('Register - desktop');
    await userEvent.click(screen.getByRole('button', { name: 'Sponsor logos' }));
    await screen.findByText('Nothing uploaded yet.');

    const file = new File(['fake-bytes'], 'sponsor.png', { type: 'image/png' });
    const input = screen.getByLabelText('Upload image for sponsor logos');
    await userEvent.upload(input, file);

    await screen.findByRole('button', { name: 'Remove' });
  });
});

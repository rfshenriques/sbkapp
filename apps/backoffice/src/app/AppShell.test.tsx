import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import { AppShell } from './AppShell';

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<p>Settlement content</p>} />
          <Route path="margins" element={<p>Margins content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // useBootstrapStaffAuth fires on every AppShell mount regardless of the
  // isInitialized value set below - stub fetch so its silent refresh
  // attempt (POST admin/staff-auth/refresh) doesn't hit real undici fetch
  // with a relative URL and throw an unhandled rejection in the console.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
});

afterEach(() => {
  useStaffAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
});

// Deliberately not unstubbing fetch per-test (only once, after every test in
// this file has run): a still-in-flight refreshStaffAccessToken() promise
// from an earlier test can settle after that test's afterEach already fired,
// and unstubbing mid-file would leave that stray call hitting real undici
// fetch with a relative URL instead of the mock.
afterAll(() => {
  vi.unstubAllGlobals();
});

describe('AppShell navigation groups', () => {
  it('shows only groups/items the ADMIN role can see, and opens a group dropdown on click', async () => {
    useStaffAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: { sub: 'staff-1', username: 'admin_alice', role: 'ADMIN' },
      isInitialized: true,
    });

    renderShell();

    expect(screen.getByRole('button', { name: 'Trading' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CMS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Customization' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff' })).toBeInTheDocument();

    expect(screen.queryByRole('link', { name: 'Margins' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trading' }));
    expect(screen.getByRole('link', { name: 'Settlement' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Margins' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Suspensions' })).toBeInTheDocument();
  });

  it('only shows the Trading group (Settlement) for a CMS-only staff member, not every group', async () => {
    useStaffAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: { sub: 'staff-2', username: 'cms_bob', role: 'CMS' },
      isInitialized: true,
    });

    renderShell();

    expect(screen.getByRole('button', { name: 'Trading' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CMS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Customization' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Staff' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Trading' }));
    // CMS role can't see Margins/Suspensions/Competition tiers, only Settlement + Competition rankings.
    expect(screen.getByRole('link', { name: 'Settlement' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Competition rankings' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Margins' })).not.toBeInTheDocument();
  });

  it('navigating via a group link closes the open dropdown', async () => {
    useStaffAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: { sub: 'staff-1', username: 'admin_alice', role: 'ADMIN' },
      isInitialized: true,
    });

    renderShell();

    await userEvent.click(screen.getByRole('button', { name: 'Trading' }));
    await userEvent.click(screen.getByRole('link', { name: 'Margins' }));

    expect(await screen.findByText('Margins content')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settlement' })).not.toBeInTheDocument();
  });
});

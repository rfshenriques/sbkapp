import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemePreferenceStore } from '../features/theme/themePreferenceStore';
import SettingsPage from './SettingsPage';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

function brandResponse(themeMode: 'DARK' | 'LIGHT') {
  return new Response(
    JSON.stringify({
      id: 'brand-1',
      name: 'Test Brand',
      logoLightUrl: null,
      logoDarkUrl: null,
      shareLogoLightUrl: null,
      shareLogoDarkUrl: null,
      themeMode,
      backgroundColor: null,
      buttonColor: null,
      highlightColor: null,
      filterColor: null,
      textColor: null,
      supportHelplineText: null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

beforeEach(() => {
  window.localStorage.clear();
  useThemePreferenceStore.setState({ preference: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  useThemePreferenceStore.setState({ preference: null });
});

describe('SettingsPage', () => {
  it('defaults to the brand theme when the player has not chosen one yet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(brandResponse('DARK')));

    renderPage();

    expect(await screen.findByRole('switch', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Use site default' })).not.toBeInTheDocument();
  });

  it('switching the toggle stores an explicit player preference and shows the reset action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(brandResponse('DARK')));

    renderPage();
    const toggle = await screen.findByRole('switch', { name: 'Dark mode' });
    await userEvent.click(toggle);

    expect(useThemePreferenceStore.getState().preference).toBe('light');
    expect(window.localStorage.getItem('theme-preference')).toBe('light');
    expect(screen.getByRole('button', { name: 'Use site default' })).toBeInTheDocument();
  });

  it('"Use site default" clears the stored preference', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(brandResponse('DARK')));
    useThemePreferenceStore.getState().setPreference('light');

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Use site default' }));

    expect(useThemePreferenceStore.getState().preference).toBeNull();
    expect(window.localStorage.getItem('theme-preference')).toBeNull();
  });
});

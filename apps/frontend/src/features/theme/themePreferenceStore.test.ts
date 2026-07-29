import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useThemePreferenceStore } from './themePreferenceStore';

beforeEach(() => {
  window.localStorage.clear();
  useThemePreferenceStore.setState({ preference: null });
});

afterEach(() => {
  window.localStorage.clear();
  useThemePreferenceStore.setState({ preference: null });
});

describe('themePreferenceStore', () => {
  it('starts with no preference (follow the brand default) when nothing is stored', () => {
    expect(useThemePreferenceStore.getState().preference).toBeNull();
  });

  it('setPreference persists to localStorage', () => {
    useThemePreferenceStore.getState().setPreference('dark');

    expect(useThemePreferenceStore.getState().preference).toBe('dark');
    expect(window.localStorage.getItem('theme-preference')).toBe('dark');
  });

  it('setPreference(null) clears the stored value', () => {
    useThemePreferenceStore.getState().setPreference('light');
    useThemePreferenceStore.getState().setPreference(null);

    expect(useThemePreferenceStore.getState().preference).toBeNull();
    expect(window.localStorage.getItem('theme-preference')).toBeNull();
  });
});

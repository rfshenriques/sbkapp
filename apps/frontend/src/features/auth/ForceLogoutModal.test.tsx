import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForceLogoutModal } from './ForceLogoutModal';
import { useForceLogoutModalStore } from './forceLogoutModalStore';

beforeEach(() => {
  useForceLogoutModalStore.setState({ isOpen: false });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ForceLogoutModal', () => {
  it('renders nothing when closed', () => {
    render(<ForceLogoutModal />);
    expect(screen.queryByText('You have been logged out')).not.toBeInTheDocument();
  });

  it('shows the message when opened, then auto-closes itself', () => {
    vi.useFakeTimers();
    render(<ForceLogoutModal />);

    act(() => {
      useForceLogoutModalStore.getState().open();
    });
    expect(screen.getByText('You have been logged out')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('You have been logged out')).not.toBeInTheDocument();
    expect(useForceLogoutModalStore.getState().isOpen).toBe(false);
  });
});

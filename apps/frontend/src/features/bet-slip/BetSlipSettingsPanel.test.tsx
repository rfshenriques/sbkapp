import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BetSlipSettingsPanel } from './BetSlipSettingsPanel';
import { useBetSlipSettingsStore } from './betSlipSettingsStore';

beforeEach(() => {
  window.localStorage.clear();
  useBetSlipSettingsStore.setState({
    autoUpdateOdds: false,
    quickStakes: [5, 10, 25, 50],
  });
});

describe('BetSlipSettingsPanel', () => {
  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(<BetSlipSettingsPanel onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Close bet slip settings' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('toggles and persists auto-update-odds immediately, without waiting for Save', async () => {
    render(<BetSlipSettingsPanel onClose={vi.fn()} />);

    const toggle = screen.getByRole('switch', { name: 'Auto-accept updated odds' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(useBetSlipSettingsStore.getState().autoUpdateOdds).toBe(true);
    expect(window.localStorage.getItem('bet-slip-auto-update-odds')).toBe('true');
  });

  it('saves edited quick stakes and closes the panel', async () => {
    const onClose = vi.fn();
    render(<BetSlipSettingsPanel onClose={onClose} />);

    const firstStake = screen.getByLabelText('Quick stake 1');
    await userEvent.clear(firstStake);
    await userEvent.type(firstStake, '2.5');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(useBetSlipSettingsStore.getState().quickStakes).toEqual([2.5, 10, 25, 50]);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not collapse a trailing decimal point while typing (2.5 must not render as 25)', async () => {
    render(<BetSlipSettingsPanel onClose={vi.fn()} />);

    const firstStake = screen.getByLabelText('Quick stake 1') as HTMLInputElement;
    await userEvent.clear(firstStake);
    await userEvent.type(firstStake, '2.');

    expect(firstStake.value).toBe('2.');
  });

  it('disables Save and does not persist when a quick stake is invalid', async () => {
    const onClose = vi.fn();
    render(<BetSlipSettingsPanel onClose={onClose} />);

    const firstStake = screen.getByLabelText('Quick stake 1');
    await userEvent.clear(firstStake);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    const storedBefore = useBetSlipSettingsStore.getState().quickStakes;
    expect(useBetSlipSettingsStore.getState().quickStakes).toEqual(storedBefore);
  });
});

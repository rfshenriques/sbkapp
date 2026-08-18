import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { CloseIcon } from '../../components/ui/CloseIcon';
import { Switch } from '../../components/ui/Switch';
import { useBetSlipSettingsStore } from './betSlipSettingsStore';

export interface BetSlipSettingsPanelProps {
  onClose: () => void;
}

/**
 * Slide-in panel over the bet slip's own content (see the gear icon and
 * `isSettingsOpen` state in BetSlipPanel) - not a separate route or a
 * BottomSheet, since it's scoped to the bet slip itself and needs to work
 * identically whether that's the mobile sheet, the tablet drawer, or
 * desktop's persistent column. Absolutely positioned over the parent's
 * `relative` root so it never affects the slip's own layout while open.
 */
export function BetSlipSettingsPanel({ onClose }: BetSlipSettingsPanelProps) {
  const autoUpdateOdds = useBetSlipSettingsStore((state) => state.autoUpdateOdds);
  const setAutoUpdateOdds = useBetSlipSettingsStore((state) => state.setAutoUpdateOdds);
  const storedQuickStakes = useBetSlipSettingsStore((state) => state.quickStakes);
  const setQuickStakes = useBetSlipSettingsStore((state) => state.setQuickStakes);

  // Raw text, not numbers - a controlled input re-derived from a parsed
  // Number on every keystroke collapses a trailing "." before the next
  // digit lands (typing "2.5" would show "25"), same fix as the
  // backoffice's insurance-bet minimum-odds field.
  const [draftText, setDraftText] = useState<string[]>(() => storedQuickStakes.map((value) => String(value)));

  const parsedDraft = draftText.map((text) => Number(text));
  const isValid = parsedDraft.every((value) => Number.isFinite(value) && value > 0);

  function handleAmountChange(index: number, value: string) {
    setDraftText((previous) => previous.map((existing, existingIndex) => (existingIndex === index ? value : existing)));
  }

  function handleSave() {
    if (isValid) {
      setQuickStakes(parsedDraft);
    }
    onClose();
  }

  return (
    <div className="sheet-slide-in-right absolute inset-0 z-10 flex flex-col overflow-hidden rounded-2xl bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-4 pb-3">
        <h2 className="font-display text-lg">Bet slip settings</h2>
        <button
          type="button"
          aria-label="Close bet slip settings"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Auto-accept updated odds</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              If a price changes in the instant before you place a bet, place it automatically at the new price
              instead of stopping to ask first.
            </p>
          </div>
          <Switch checked={autoUpdateOdds} onChange={setAutoUpdateOdds} ariaLabel="Auto-accept updated odds" />
        </div>

        <div>
          <p className="text-sm font-semibold">Quick stakes</p>
          <p className="mt-0.5 mb-2 text-xs text-text-secondary">
            4 amounts you stake often - shown as one-tap buttons under the stake field.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {draftText.map((value, index) => (
              <div key={index}>
                <label htmlFor={`quick-stake-${index}`} className="sr-only">
                  Quick stake {index + 1}
                </label>
                <input
                  id={`quick-stake-${index}`}
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={(event) => handleAmountChange(index, event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <Button variant="primary" className="w-full" disabled={!isValid} onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

import type { ColorValue, ColorZone, GradientDirection } from '../lib/backendApi';
import { GRADIENT_DIRECTIONS } from '../lib/backendApi';

const DEFAULT_ZONE: ColorZone = {
  light: { type: 'solid', hex: '#000000' },
  dark: { type: 'solid', hex: '#ffffff' },
};

const DIRECTION_LABELS: Record<GradientDirection, string> = {
  'to-t': 'Up',
  'to-b': 'Down',
  'to-l': 'Left',
  'to-r': 'Right',
  'to-tl': 'Up-left',
  'to-tr': 'Up-right',
  'to-bl': 'Down-left',
  'to-br': 'Down-right',
};

function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function HexInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label} swatch`}
        value={isValidHex(value) ? value : '#000000'}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
      />
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="#22c55e"
        className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function ColorValueEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ColorValue;
  onChange: (value: ColorValue) => void;
}) {
  return (
    <div>
      <p className="text-xs text-text-secondary">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <select
          aria-label={`${label} type`}
          value={value.type}
          onChange={(event) => {
            if (event.target.value === 'solid') {
              onChange({ type: 'solid', hex: value.type === 'gradient' ? value.fromHex : '#000000' });
            } else {
              onChange({
                type: 'gradient',
                direction: 'to-r',
                fromHex: value.type === 'solid' ? value.hex : '#000000',
                toHex: '#ffffff',
              });
            }
          }}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
        </select>

        {value.type === 'solid' ? (
          <HexInput label={`${label} color`} value={value.hex} onChange={(hex) => onChange({ type: 'solid', hex })} />
        ) : (
          <>
            <select
              aria-label={`${label} gradient direction`}
              value={value.direction}
              onChange={(event) => onChange({ ...value, direction: event.target.value as GradientDirection })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {GRADIENT_DIRECTIONS.map((direction) => (
                <option key={direction} value={direction}>
                  {DIRECTION_LABELS[direction]}
                </option>
              ))}
            </select>
            <HexInput
              label={`${label} gradient start`}
              value={value.fromHex}
              onChange={(fromHex) => onChange({ ...value, fromHex })}
            />
            <HexInput
              label={`${label} gradient end`}
              value={value.toHex}
              onChange={(toHex) => onChange({ ...value, toHex })}
            />
          </>
        )}
      </div>
    </div>
  );
}

interface ColorZoneEditorProps {
  label: string;
  description?: string;
  value: ColorZone | null;
  onChange: (value: ColorZone | null) => void;
}

/** One brand-configurable color zone (background, button, highlight, filter, or text) - can be left unset (falls back to the fixed built-in default), or configured with an independent light and dark value, each solid or a 2-stop gradient. */
export function ColorZoneEditor({ label, description, value, onChange }: ColorZoneEditorProps) {
  const enabled = value !== null;
  const current = value ?? DEFAULT_ZONE;

  return (
    <div className="rounded-md border border-border p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange(event.target.checked ? DEFAULT_ZONE : null)}
        />
        {label}
      </label>
      {description && <p className="mt-1 text-xs text-text-secondary">{description}</p>}
      {enabled && (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorValueEditor label="Light" value={current.light} onChange={(light) => onChange({ ...current, light })} />
          <ColorValueEditor label="Dark" value={current.dark} onChange={(dark) => onChange({ ...current, dark })} />
        </div>
      )}
    </div>
  );
}

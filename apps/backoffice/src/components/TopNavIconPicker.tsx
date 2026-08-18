import { TOP_NAV_ICON_KEYS, TOP_NAV_ICON_LABELS, type TopNavIconKey } from '@sportsbook/shared';
import { TopNavIcon } from './ui/TopNavIcon';

/**
 * Grid of the fixed, consistently-designed icon set a staff member picks
 * from when adding or editing a top nav item - the icon is freely chosen,
 * independent of the item's kind (see backend's TopNavItem.icon).
 */
export function TopNavIconPicker({
  value,
  onChange,
}: {
  value: TopNavIconKey;
  onChange: (icon: TopNavIconKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Icon">
      {TOP_NAV_ICON_KEYS.map((key) => {
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            aria-label={TOP_NAV_ICON_LABELS[key]}
            title={TOP_NAV_ICON_LABELS[key]}
            onClick={() => onChange(key)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
              selected
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-border bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            <TopNavIcon icon={key} width={18} height={18} />
          </button>
        );
      })}
    </div>
  );
}

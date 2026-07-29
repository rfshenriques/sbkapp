import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { GearIcon } from '../components/ui/NavIcons';
import { SunMoonToggle } from '../components/ui/SunMoonToggle';
import { useThemePreferenceStore } from '../features/theme/themePreferenceStore';
import { getPublicBrand } from '../lib/backendApi';
import { cn } from '../lib/cn';

export default function SettingsPage() {
  const preference = useThemePreferenceStore((state) => state.preference);
  const setPreference = useThemePreferenceStore((state) => state.setPreference);
  const { data: brand } = useQuery({
    queryKey: ['public-brand', typeof window === 'undefined' ? '' : window.location.hostname],
    queryFn: getPublicBrand,
    staleTime: Infinity,
  });
  const isDark = preference ? preference === 'dark' : brand?.themeMode !== 'LIGHT';

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <GearIcon width={22} height={22} />
        <h1 className="font-display text-lg">Settings</h1>
      </div>

      <Card className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">Appearance</p>
          <p className="text-xs text-text-muted">Choose how the app looks on this device.</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={cn(!isDark ? 'text-text-primary' : 'text-text-muted', 'text-sm font-semibold')}>
            Light
          </span>
          <SunMoonToggle
            checked={isDark}
            onChange={(checked) => setPreference(checked ? 'dark' : 'light')}
            ariaLabel="Dark mode"
            id="theme-toggle"
          />
          <span className={cn(isDark ? 'text-text-primary' : 'text-text-muted', 'text-sm font-semibold')}>Dark</span>
        </div>

        {preference && (
          <button
            type="button"
            onClick={() => setPreference(null)}
            className="text-xs font-semibold text-highlight hover:underline"
          >
            Use site default
          </button>
        )}
      </Card>
    </div>
  );
}

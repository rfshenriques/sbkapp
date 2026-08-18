import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ColorZoneEditor } from '../components/ColorZoneEditor';
import { LogoSlotUploader } from '../components/LogoSlotUploader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import type { BrandLogoSlot, ColorZone } from '../lib/backendApi';
import * as backendApi from '../lib/backendApi';
import { CURRENCY_CODES, KNOWN_PRODUCTS } from '../lib/backendApi';

const PRODUCT_LABELS: Record<string, string> = {
  CASHOUT: 'Cashout',
  BET_BUILDER: 'Bet builder',
};

const LOGO_SLOTS: { slot: BrandLogoSlot; label: string; urlField: 'logoLightUrl' | 'logoDarkUrl' | 'shareLogoLightUrl' | 'shareLogoDarkUrl' }[] = [
  { slot: 'SITE_LIGHT', label: 'Site logo (light)', urlField: 'logoLightUrl' },
  { slot: 'SITE_DARK', label: 'Site logo (dark)', urlField: 'logoDarkUrl' },
  { slot: 'SHARE_LIGHT', label: 'Bet-share logo (light)', urlField: 'shareLogoLightUrl' },
  { slot: 'SHARE_DARK', label: 'Bet-share logo (dark)', urlField: 'shareLogoDarkUrl' },
];

export default function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const brandQueryKey = ['brand', id] as const;

  const {
    data: brand,
    isPending,
    isError,
  } = useQuery({
    queryKey: brandQueryKey,
    queryFn: () => backendApi.getBrand(id!),
    enabled: Boolean(id),
  });

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [themeMode, setThemeMode] = useState<backendApi.ThemeMode>('DARK');
  const [currencyCode, setCurrencyCode] = useState('EUR');
  const [timeFormat, setTimeFormat] = useState<backendApi.TimeFormat>('H24');
  const [backgroundColor, setBackgroundColor] = useState<ColorZone | null>(null);
  const [surfaceColor, setSurfaceColor] = useState<ColorZone | null>(null);
  const [buttonColor, setButtonColor] = useState<ColorZone | null>(null);
  const [highlightColor, setHighlightColor] = useState<ColorZone | null>(null);
  const [filterColor, setFilterColor] = useState<ColorZone | null>(null);
  const [textColor, setTextColor] = useState<ColorZone | null>(null);
  const [freebetBadgeColor, setFreebetBadgeColor] = useState<ColorZone | null>(null);
  const [freebetStakeReturnedOnWin, setFreebetStakeReturnedOnWin] = useState(true);

  useEffect(() => {
    if (!brand) return;
    setName(brand.name);
    setDomain(brand.domain ?? '');
    setThemeMode(brand.themeMode);
    setCurrencyCode(brand.currencyCode);
    setTimeFormat(brand.timeFormat);
    setBackgroundColor(brand.backgroundColor);
    setSurfaceColor(brand.surfaceColor);
    setButtonColor(brand.buttonColor);
    setHighlightColor(brand.highlightColor);
    setFilterColor(brand.filterColor);
    setTextColor(brand.textColor);
    setFreebetBadgeColor(brand.freebetBadgeColor);
    setFreebetStakeReturnedOnWin(brand.freebetStakeReturnedOnWin);
  }, [brand]);

  const updateMutation = useMutation({
    mutationFn: (payload: backendApi.UpdateBrandPayload) => backendApi.updateBrand(id!, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(brandQueryKey, updated);
      void queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });

  const productFlagMutation = useMutation({
    mutationFn: ({ product, enabled }: { product: string; enabled: boolean }) =>
      backendApi.setProductFlag(id!, product, enabled),
    onSuccess: (updated) => {
      queryClient.setQueryData(brandQueryKey, updated);
      void queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: ({ slot, file }: { slot: BrandLogoSlot; file: File }) => backendApi.uploadBrandLogo(id!, slot, file),
    onSuccess: (updated) => {
      queryClient.setQueryData(brandQueryKey, updated);
      void queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: (slot: BrandLogoSlot) => backendApi.removeBrandLogo(id!, slot),
    onSuccess: (updated) => {
      queryClient.setQueryData(brandQueryKey, updated);
      void queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });

  const colorFields = {
    backgroundColor: backgroundColor ?? undefined,
    surfaceColor: surfaceColor ?? undefined,
    buttonColor: buttonColor ?? undefined,
    highlightColor: highlightColor ?? undefined,
    filterColor: filterColor ?? undefined,
    textColor: textColor ?? undefined,
    freebetBadgeColor: freebetBadgeColor ?? undefined,
  };

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    updateMutation.mutate({
      name,
      domain: domain || undefined,
      themeMode,
      currencyCode,
      timeFormat,
      freebetStakeReturnedOnWin,
      ...colorFields,
    });
  }

  // A dedicated save for the Colors card, so a color edit made up here
  // doesn't depend on scrolling down to the unrelated "Brand configuration"
  // card's own "Save changes" button to actually persist (see PATCH
  // /brands/:id - every field is independently optional, so this partial
  // payload is a normal update, not a special case).
  function handleSaveColors() {
    updateMutation.mutate(colorFields);
  }

  function isProductEnabled(product: string): boolean {
    return brand?.productFlags.find((flag) => flag.product === product)?.enabled ?? false;
  }

  return (
    <div>
      <Link to="/" className="text-sm text-text-secondary hover:text-text-primary">
        ← Brands
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{brand?.name ?? 'Brand'}</h1>

      {isPending && (
        <div className="mt-4 space-y-2" aria-label="Loading brand" role="status">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      {isError && <p className="mt-4 text-sm text-danger">Failed to load brand.</p>}

      {brand && (
        <>
          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Logos</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Site logos render in the header; bet-share logos render on the image generated when a player shares a
              bet slip. Each has its own light and dark variant since a single logo often reads badly against one of
              the two backgrounds.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {LOGO_SLOTS.map(({ slot, label, urlField }) => (
                <LogoSlotUploader
                  key={slot}
                  inputId={`brand-logo-${slot}`}
                  label={label}
                  url={brand[urlField]}
                  isUploading={uploadLogoMutation.isPending && uploadLogoMutation.variables?.slot === slot}
                  isRemoving={removeLogoMutation.isPending && removeLogoMutation.variables === slot}
                  onFileSelected={(file) => uploadLogoMutation.mutate({ slot, file })}
                  onRemove={() => removeLogoMutation.mutate(slot)}
                />
              ))}
            </div>
            {uploadLogoMutation.isError && (
              <p className="mt-2 text-sm text-danger">
                {uploadLogoMutation.error instanceof Error ? uploadLogoMutation.error.message : 'Failed to upload logo.'}
              </p>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Colors</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Every zone is independent for light and dark, and each can be a solid color or a 2-stop gradient. Leave
              a zone unchecked to keep the fixed built-in default for it.
            </p>
            <div className="mt-3 space-y-3">
              <ColorZoneEditor
                label="Background"
                description="The page background behind everything else."
                value={backgroundColor}
                onChange={setBackgroundColor}
              />
              <ColorZoneEditor
                label="Surface"
                description="Elements sitting above the background - cards, panels, dropdowns."
                value={surfaceColor}
                onChange={setSurfaceColor}
              />
              <ColorZoneEditor
                label="Button / CTA"
                description="Register, Place Bet, Browse matches, and other primary actions."
                value={buttonColor}
                onChange={setButtonColor}
              />
              <ColorZoneEditor
                label="Highlight"
                description="General accent - selected odds, kickoff times, status badges."
                value={highlightColor}
                onChange={setHighlightColor}
              />
              <ColorZoneEditor
                label="Filter"
                description="Tab and filter-chip active states - kept distinct from Button so a filter never reads as a CTA."
                value={filterColor}
                onChange={setFilterColor}
              />
              <ColorZoneEditor label="Text" description="Primary text color." value={textColor} onChange={setTextColor} />
              <ColorZoneEditor
                label="Freebet badge"
                description="The circular 'F' freebet-balance badge's fill - its ring/letter color always auto-picks black or white for legibility against whatever this is set to."
                value={freebetBadgeColor}
                onChange={setFreebetBadgeColor}
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button
                type="button"
                disabled={updateMutation.isPending}
                onClick={handleSaveColors}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save colors'}
              </Button>
              {updateMutation.isError && (
                <p className="text-sm text-danger">
                  {updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to save colors.'}
                </p>
              )}
            </div>
          </Card>

          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Brand configuration</h2>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <div>
                <label htmlFor="brand-name" className="block text-xs text-text-secondary">
                  Name
                </label>
                <input
                  id="brand-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="brand-domain" className="block text-xs text-text-secondary">
                  Domain
                </label>
                <input
                  id="brand-domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="www.mysportsbook.com"
                  className="mt-1 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="brand-theme-mode" className="block text-xs text-text-secondary">
                  Default appearance
                </label>
                <select
                  id="brand-theme-mode"
                  value={themeMode}
                  onChange={(event) => setThemeMode(event.target.value as backendApi.ThemeMode)}
                  className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="DARK">Dark</option>
                  <option value="LIGHT">Light</option>
                </select>
                <p className="mt-1 text-xs text-text-secondary">
                  Which theme a player sees until they pick their own in Settings - both light and dark are always
                  configured above regardless of this default.
                </p>
              </div>
              <div>
                <label htmlFor="brand-currency" className="block text-xs text-text-secondary">
                  Currency
                </label>
                <select
                  id="brand-currency"
                  value={currencyCode}
                  onChange={(event) => setCurrencyCode(event.target.value)}
                  className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {CURRENCY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-text-secondary">
                  Shown on every stake, payout, campaign, and wallet amount a player sees.
                </p>
              </div>
              <div>
                <label htmlFor="brand-time-format" className="block text-xs text-text-secondary">
                  Time format
                </label>
                <select
                  id="brand-time-format"
                  value={timeFormat}
                  onChange={(event) => setTimeFormat(event.target.value as backendApi.TimeFormat)}
                  className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="H24">24-hour (18:30)</option>
                  <option value="H12">12-hour (6:30 PM)</option>
                </select>
                <p className="mt-1 text-xs text-text-secondary">
                  How kickoff and match times display on the player app.
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={freebetStakeReturnedOnWin}
                    onChange={(event) => setFreebetStakeReturnedOnWin(event.target.checked)}
                  />
                  Freebet stake is returned on a win (e.g. a 10 € freebet at odds 9.00 pays 90 € total,
                  not just 80 € in net winnings) - either way winnings always land in the player's cash
                  balance, never back into freebets.
                </label>
              </div>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
              {updateMutation.isError && (
                <p className="text-sm text-danger">
                  {updateMutation.error instanceof Error
                    ? updateMutation.error.message
                    : 'Failed to update brand.'}
                </p>
              )}
            </form>
          </Card>

          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Products</h2>
            <div className="mt-3 space-y-2">
              {KNOWN_PRODUCTS.map((product) => {
                const enabled = isProductEnabled(product);
                return (
                  <div
                    key={product}
                    className="flex items-center justify-between rounded-md bg-background px-3 py-2"
                  >
                    <span className="text-sm">{PRODUCT_LABELS[product] ?? product}</span>
                    <Button
                      variant={enabled ? 'secondary' : 'primary'}
                      disabled={productFlagMutation.isPending}
                      onClick={() => productFlagMutation.mutate({ product, enabled: !enabled })}
                    >
                      {enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

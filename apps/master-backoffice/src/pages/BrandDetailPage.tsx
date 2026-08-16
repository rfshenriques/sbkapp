import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import * as backendApi from '../lib/backendApi';
import { KNOWN_PRODUCTS } from '../lib/backendApi';

const PRODUCT_LABELS: Record<string, string> = {
  CASHOUT: 'Cashout',
  BET_BUILDER: 'Bet builder',
};

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
  const [logoUrl, setLogoUrl] = useState('');
  const [themeMode, setThemeMode] = useState<backendApi.ThemeMode>('DARK');
  const [buttonColorHex, setButtonColorHex] = useState('');
  const [highlightColorHex, setHighlightColorHex] = useState('');
  const [filterColorHex, setFilterColorHex] = useState('');
  const [freebetStakeReturnedOnWin, setFreebetStakeReturnedOnWin] = useState(true);

  useEffect(() => {
    if (!brand) return;
    setName(brand.name);
    setDomain(brand.domain ?? '');
    setLogoUrl(brand.logoUrl ?? '');
    setThemeMode(brand.themeMode);
    setButtonColorHex(brand.buttonColorHex ?? '');
    setHighlightColorHex(brand.highlightColorHex ?? '');
    setFilterColorHex(brand.filterColorHex ?? '');
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    updateMutation.mutate({
      name,
      domain: domain || undefined,
      logoUrl: logoUrl || undefined,
      themeMode,
      buttonColorHex: buttonColorHex || undefined,
      highlightColorHex: highlightColorHex || undefined,
      filterColorHex: filterColorHex || undefined,
      freebetStakeReturnedOnWin,
    });
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
                <label htmlFor="brand-logo" className="block text-xs text-text-secondary">
                  Logo URL
                </label>
                <input
                  id="brand-logo"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="mt-1 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="brand-theme-mode" className="block text-xs text-text-secondary">
                  Appearance
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
              </div>
              <div className="flex gap-4">
                <div>
                  <label htmlFor="brand-button-color" className="block text-xs text-text-secondary">
                    Button color
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Button color swatch"
                      value={/^#[0-9a-fA-F]{6}$/.test(buttonColorHex) ? buttonColorHex : '#000000'}
                      onChange={(event) => setButtonColorHex(event.target.value)}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
                    />
                    <input
                      id="brand-button-color"
                      value={buttonColorHex}
                      onChange={(event) => setButtonColorHex(event.target.value)}
                      placeholder="#22c55e"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="brand-highlight-color"
                    className="block text-xs text-text-secondary"
                  >
                    Highlight color
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Highlight color swatch"
                      value={/^#[0-9a-fA-F]{6}$/.test(highlightColorHex) ? highlightColorHex : '#000000'}
                      onChange={(event) => setHighlightColorHex(event.target.value)}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
                    />
                    <input
                      id="brand-highlight-color"
                      value={highlightColorHex}
                      onChange={(event) => setHighlightColorHex(event.target.value)}
                      placeholder="#f59e0b"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="brand-filter-color"
                    className="block text-xs text-text-secondary"
                  >
                    Filter color
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Filter color swatch"
                      value={/^#[0-9a-fA-F]{6}$/.test(filterColorHex) ? filterColorHex : '#000000'}
                      onChange={(event) => setFilterColorHex(event.target.value)}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
                    />
                    <input
                      id="brand-filter-color"
                      value={filterColorHex}
                      onChange={(event) => setFilterColorHex(event.target.value)}
                      placeholder="#22d3ee"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
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

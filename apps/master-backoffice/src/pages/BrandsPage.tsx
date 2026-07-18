import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';

const brandsQueryKey = ['brands'] as const;

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const {
    data: brands,
    isPending,
    isError,
  } = useQuery({ queryKey: brandsQueryKey, queryFn: backendApi.listBrands });

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [domain, setDomain] = useState('');

  const createMutation = useMutation({
    mutationFn: backendApi.createBrand,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: brandsQueryKey });
      setName('');
      setSlug('');
      setDomain('');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({ name, slug, domain: domain || undefined });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Brands</h1>

      <Card className="mt-4">
        <h2 className="text-sm font-medium text-text-secondary">Add brand</h2>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="new-brand-name" className="block text-xs text-text-secondary">
              Name
            </label>
            <input
              id="new-brand-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="new-brand-slug" className="block text-xs text-text-secondary">
              Slug
            </label>
            <input
              id="new-brand-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="my-sportsbook"
              className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="new-brand-domain" className="block text-xs text-text-secondary">
              Domain (optional)
            </label>
            <input
              id="new-brand-domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="www.mysportsbook.com"
              className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding…' : 'Add brand'}
          </Button>
        </form>
        {createMutation.isError && (
          <p className="mt-2 text-sm text-danger">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : 'Failed to create brand.'}
          </p>
        )}
      </Card>

      <Card className="mt-4">
        {isPending && <p className="text-sm text-text-secondary">Loading brands…</p>}
        {isError && <p className="text-sm text-danger">Failed to load brands.</p>}
        {brands && brands.length === 0 && (
          <p className="text-sm text-text-secondary">No brands yet.</p>
        )}
        {brands && brands.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Slug</th>
                <th className="py-2 font-medium">Domain</th>
                <th className="py-2 font-medium">Products enabled</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.id} className="border-b border-border last:border-0">
                  <td className="py-2">
                    <Link to={`/brands/${brand.id}`} className="text-brand hover:underline">
                      {brand.name}
                    </Link>
                  </td>
                  <td className="py-2 text-text-secondary">{brand.slug}</td>
                  <td className="py-2 text-text-secondary">{brand.domain ?? '—'}</td>
                  <td className="py-2 text-text-secondary">
                    {brand.productFlags.filter((flag) => flag.enabled).length} /{' '}
                    {brand.productFlags.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

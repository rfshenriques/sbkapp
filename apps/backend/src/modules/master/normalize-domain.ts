/**
 * `www.betsome.pt` and `betsome.pt` should resolve to the same brand even
 * though `Brand.domain` stores a single string - DNS-level canonicalization
 * (redirecting one to the other) is the "real" fix, but normalizing both at
 * storage time (brands.service.ts) and at lookup time
 * (public-brand.controller.ts) means a brand set up with either form still
 * resolves correctly without depending on that being configured first.
 */
export function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

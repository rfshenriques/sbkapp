import type { Market } from '@sportsbook/shared';

export type MarketCategory = 'main' | 'totals' | 'handicaps';

export const MARKET_CATEGORY_LABELS: Record<MarketCategory, string> = {
  main: 'Main',
  totals: 'Totals',
  handicaps: 'Handicaps',
};

/** Groups a match's non-special markets into the same handful of tabs a
 * player would recognize from any sportsbook - anything not recognized as
 * a totals or handicap line (match result, double chance, both teams to
 * score, manual markets, ...) falls back to Main rather than being dropped. */
export function marketCategory(market: Pick<Market, 'id'>): MarketCategory {
  if (market.id.startsWith('total-goals')) return 'totals';
  if (market.id.startsWith('handicap')) return 'handicaps';
  return 'main';
}

export function groupMarketsByCategory<T extends Pick<Market, 'id'>>(markets: T[]): Record<MarketCategory, T[]> {
  const groups: Record<MarketCategory, T[]> = { main: [], totals: [], handicaps: [] };
  for (const market of markets) {
    groups[marketCategory(market)].push(market);
  }
  return groups;
}

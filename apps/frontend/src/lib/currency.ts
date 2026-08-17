import { useBrandStore } from '../features/brand/brandStore';

/** The active brand's currency (see Brand.currencyCode, resolved by useBrandTheme into brandStore) - EUR until that resolves, matching every deployment's actual currency before this field existed. */
export function activeCurrencyCode(): string {
  return useBrandStore.getState().currencyCode;
}

/**
 * Deliberately not Intl.NumberFormat's locale-driven placement/separators -
 * this app has no locale switcher, and every money display has always used
 * the same fixed "amount SYMBOL" (dot-decimal, trailing symbol) convention
 * regardless of a visitor's own browser locale. Swapping to Intl would make
 * the format silently vary per viewer's OS locale (prefix vs suffix, comma
 * vs dot) on top of the currency swap, which isn't what was asked for.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  BRL: 'R$',
  MXN: '$',
  CAD: '$',
  AUD: '$',
  CHF: 'CHF',
};

function currencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] ?? currencyCode;
}

/** Just the symbol, e.g. for a currency-input's decorative prefix glyph or a bare preset-amount button where there's no cents value to run through formatMoney. */
export function activeCurrencySymbol(): string {
  return currencySymbol(activeCurrencyCode());
}

/** Full precision (always 2 decimals) - stakes, payouts, potential payouts, campaign/insurance before-and-after values. Defaults to the active brand's currency; pass one explicitly only when formatting a different brand's money (there's no such case today). */
export function formatMoney(cents: number, currencyCode: string = activeCurrencyCode()): string {
  return `${(cents / 100).toFixed(2)} ${currencySymbol(currencyCode)}`;
}

/**
 * Smart-decimal - a whole amount drops its decimals (43 stays "43 €", not
 * "43.00 €"), a genuinely fractional one keeps them (43.50 €). Wallet
 * balances only (see BalancePills) - every other money display always
 * wants full precision via formatMoney above.
 */
export function formatMoneySmart(cents: number, currencyCode: string = activeCurrencyCode()): string {
  const value = cents / 100;
  const amount = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
  return `${amount} ${currencySymbol(currencyCode)}`;
}

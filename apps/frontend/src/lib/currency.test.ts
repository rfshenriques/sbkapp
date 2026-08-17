import { afterEach, describe, expect, it } from 'vitest';
import { useBrandStore } from '../features/brand/brandStore';
import { activeCurrencySymbol, formatMoney, formatMoneySmart } from './currency';

afterEach(() => {
  useBrandStore.setState({ currencyCode: 'EUR' });
});

describe('formatMoney', () => {
  it('always shows 2 decimals with the active brand currency symbol', () => {
    expect(formatMoney(4300)).toBe('43.00 €');
    expect(formatMoney(4350)).toBe('43.50 €');
  });

  it('uses a currency explicitly passed instead of the active brand', () => {
    expect(formatMoney(4300, 'USD')).toBe('43.00 $');
    expect(formatMoney(4300, 'GBP')).toBe('43.00 £');
  });

  it('falls back to the raw code for an unmapped currency', () => {
    expect(formatMoney(4300, 'JPY')).toBe('43.00 JPY');
  });

  it('reacts to the active brand changing', () => {
    useBrandStore.setState({ currencyCode: 'BRL' });
    expect(formatMoney(4300)).toBe('43.00 R$');
  });
});

describe('formatMoneySmart', () => {
  it('drops decimals for a whole amount, keeps them for a fractional one', () => {
    expect(formatMoneySmart(4300)).toBe('43 €');
    expect(formatMoneySmart(4350)).toBe('43.50 €');
  });
});

describe('activeCurrencySymbol', () => {
  it('resolves the symbol for the active brand currency', () => {
    expect(activeCurrencySymbol()).toBe('€');
    useBrandStore.setState({ currencyCode: 'CHF' });
    expect(activeCurrencySymbol()).toBe('CHF');
  });
});

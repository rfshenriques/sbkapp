import { describe, expect, it } from 'vitest';
import { TOP_NAV_ICON_KEYS, TOP_NAV_ICON_LABELS, TOP_NAV_ICON_SHAPES } from './topNavIcons';

describe('topNavIcons', () => {
  it('has a label and at least one shape for every key, in both directions', () => {
    expect(new Set(Object.keys(TOP_NAV_ICON_LABELS))).toEqual(new Set(TOP_NAV_ICON_KEYS));
    expect(new Set(Object.keys(TOP_NAV_ICON_SHAPES))).toEqual(new Set(TOP_NAV_ICON_KEYS));
    for (const key of TOP_NAV_ICON_KEYS) {
      expect(TOP_NAV_ICON_SHAPES[key].length).toBeGreaterThan(0);
      expect(TOP_NAV_ICON_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate keys', () => {
    expect(new Set(TOP_NAV_ICON_KEYS).size).toBe(TOP_NAV_ICON_KEYS.length);
  });
});

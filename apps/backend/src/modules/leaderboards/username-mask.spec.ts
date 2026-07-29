import { describe, expect, it } from 'vitest';
import { maskUsername } from './username-mask';

describe('maskUsername', () => {
  it('keeps the first 3 characters and masks the rest', () => {
    expect(maskUsername('alexander')).toBe('ale****');
  });

  it('exactly 3 characters: the whole thing is kept, then masked', () => {
    expect(maskUsername('bob')).toBe('bob****');
  });

  it('shorter than 3 characters: whatever is there, then masked', () => {
    expect(maskUsername('al')).toBe('al****');
    expect(maskUsername('a')).toBe('a****');
  });

  it('empty string: just the mask', () => {
    expect(maskUsername('')).toBe('****');
  });

  it('does not split an astral-plane character (e.g. an emoji) in the prefix', () => {
    // U+1F600 (grinning face) is a surrogate pair in UTF-16 - String.slice(0,3)
    // would cut it in half; Array.from must not.
    const username = '😀bob';
    expect(maskUsername(username)).toBe('😀bo****');
  });
});

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useContrastColor } from './useContrastColor';

function setCssVariable(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

afterEach(() => {
  document.documentElement.style.removeProperty('--test-color');
});

describe('useContrastColor', () => {
  it('picks white against the default gold highlight (#f5b301) - not so pale it needs dark text', () => {
    setCssVariable('--test-color', '#f5b301');
    const { result } = renderHook(() => useContrastColor('--test-color'));
    expect(result.current).toBe('white');
  });

  it('picks black against a genuinely pale color', () => {
    setCssVariable('--test-color', '#fef08a');
    const { result } = renderHook(() => useContrastColor('--test-color'));
    expect(result.current).toBe('black');
  });

  it('picks white against a dark color', () => {
    setCssVariable('--test-color', '#111111');
    const { result } = renderHook(() => useContrastColor('--test-color'));
    expect(result.current).toBe('white');
  });
});

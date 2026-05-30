import { describe, expect, it } from 'vitest';
import { isThemePref, resolveTheme, THEME_PREFS } from './theme';

describe('resolveTheme', () => {
  it('follows the system preference when pref is "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('forces the chosen theme regardless of system when pref is explicit', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('isThemePref', () => {
  it('accepts the three valid preferences', () => {
    for (const p of THEME_PREFS) expect(isThemePref(p)).toBe(true);
  });

  it('rejects anything else (guards untrusted localStorage values)', () => {
    expect(isThemePref('blue')).toBe(false);
    expect(isThemePref(null)).toBe(false);
    expect(isThemePref(undefined)).toBe(false);
    expect(isThemePref('')).toBe(false);
  });
});

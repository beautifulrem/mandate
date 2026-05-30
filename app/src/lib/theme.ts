// Theme preference model. `system` follows the OS; `light`/`dark` force it.
// Pure helpers here are unit-tested; the DOM application lives in ThemeToggle
// and (for no-flash first paint) in the inline script in layout.tsx.

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'mandate-theme';
export const THEME_PREFS: ThemePref[] = ['system', 'light', 'dark'];

export function resolveTheme(pref: ThemePref, systemPrefersDark: boolean): Theme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'system' || value === 'light' || value === 'dark';
}

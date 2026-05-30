'use client';

import { useEffect, useState } from 'react';
import { isThemePref, resolveTheme, THEME_KEY, THEME_PREFS, type ThemePref } from '../lib/theme';

const ICON: Record<ThemePref, string> = { system: '🖥️', light: '☀️', dark: '🌙' };
const DEFAULT_LABELS: Record<ThemePref, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/**
 * Light / Dark / System theme switch. Stores the *preference* (not the resolved
 * theme) so "System" keeps tracking the OS even after the user picks it. The
 * resolved theme is written to <html data-theme> — matching the inline no-flash
 * script in layout.tsx.
 */
export function ThemeToggle({ labels = DEFAULT_LABELS }: { labels?: Record<ThemePref, string> }) {
  const [pref, setPref] = useState<ThemePref>('system');

  // Load stored preference after mount — server renders the 'system' default,
  // so the first client render matches (no hydration mismatch).
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (isThemePref(stored)) setPref(stored);
  }, []);

  // Apply on change, and keep following the OS while the preference is 'system'.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(pref, mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);

  const choose = (p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem(THEME_KEY, p);
    } catch {
      /* private mode — in-memory only */
    }
  };

  return (
    <div className="seg" role="group" aria-label={labels.system + ' / ' + labels.light + ' / ' + labels.dark}>
      {THEME_PREFS.map((p) => (
        <button
          key={p}
          type="button"
          className={`seg-btn ${pref === p ? 'on' : ''}`}
          aria-pressed={pref === p}
          title={labels[p]}
          onClick={() => choose(p)}
        >
          <span aria-hidden>{ICON[p]}</span>
        </button>
      ))}
    </div>
  );
}

import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { THEME_KEY } from '../lib/theme';
import { Providers } from './providers';
import './globals.css';

// Web3 type system: Inter (body), Space Grotesk (display/headings), JetBrains Mono
// (addresses, hashes, numbers — tabular figures). Self-hosted via next/font (no CLS,
// no external request). Non-latin (中文) falls back to the system CJK stack per-glyph.
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Mandate — Revocable AI Governance Delegation',
  description:
    'Grant an AI agent scoped, revocable authority to vote on your behalf — and kill the whole delegation chain on-chain in seconds.',
};

// Runs before first paint so the page never flashes the wrong theme. Mirrors
// resolveTheme() from lib/theme: explicit pref wins, otherwise follow the OS.
const THEME_INIT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script sets data-theme, and browser
    // extensions (Dark Reader, …) inject attributes — both are benign mismatches.
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

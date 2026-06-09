import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import { Providers } from './providers';
import './globals.css';

// Body type: Inter (latin), self-hosted via next/font (no CLS, no external request).
const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

// Maple Mono — the brand display + mono face: a rounded monospace that gives the Mission-Control
// HUD its terminal character (headings, KPIs, node names, and every address / hash / number).
// Latin weights are self-hosted as woff2 (~76KB each). 中文 is covered by Maple Mono CN, SUBSET to
// the ~470 glyphs this app actually ships (so it stays ~100KB instead of ~18MB) and renders
// cohesively instead of falling back to a system CJK face. The Nerd-Font icon glyphs are omitted —
// the app draws every icon with lucide-react. CN is preload:false (non-latin best practice).
const maple = localFont({
  variable: '--font-maple',
  display: 'swap',
  src: [
    { path: './fonts/maple/MapleMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/maple/MapleMono-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/maple/MapleMono-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/maple/MapleMono-Bold.woff2', weight: '700', style: 'normal' },
  ],
});
const mapleCN = localFont({
  variable: '--font-maple-cn',
  display: 'swap',
  preload: false,
  src: [
    { path: './fonts/maple/MapleMonoCN-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/maple/MapleMonoCN-Bold.woff2', weight: '700', style: 'normal' },
  ],
});

export const metadata: Metadata = {
  title: 'Mandate: Revocable AI Governance Delegation',
  description:
    'Grant an AI agent scoped, revocable authority to vote on your behalf, and kill the whole delegation chain on-chain in seconds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The redesign is dark-only — lock data-theme=dark. suppressHydrationWarning
    // because browser extensions (Dark Reader, …) inject attributes (benign).
    <html
      lang="en"
      data-theme="dark"
      className={`${sans.variable} ${maple.variable} ${mapleCN.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <div className="aurora" aria-hidden="true">
          <span className="aurora-orb" />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

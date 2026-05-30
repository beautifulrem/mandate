import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mandate — Revocable AI Governance Delegation',
  description:
    'Grant an AI agent scoped, revocable authority to vote on your behalf — and kill the whole delegation chain on-chain in seconds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (Dark Reader, Immersive Translate, …) inject
    // attributes onto <html>/<body> before React hydrates — a benign mismatch, not our markup.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

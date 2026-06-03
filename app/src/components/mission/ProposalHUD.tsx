'use client';

import type { DaoProposal } from '@mandate/shared';
import type { Dict, Lang } from '../../lib/i18n';
import { StatusDot } from '../ui/Badge';

/**
 * Top-center proposal HUD — the live status line (voting now · n/total · #id), the proposal title +
 * body, a segmented For/Against/Abstain micro-tally from the proposal's seeded distribution, and the
 * progress dots that rotate / select proposals.
 */
export function ProposalHUD({
  proposal,
  activeIdx,
  count,
  onSelect,
  lang,
  t,
}: {
  proposal: DaoProposal;
  activeIdx: number;
  count: number;
  onSelect: (i: number) => void;
  lang: Lang;
  t: Dict;
}) {
  const counts = proposal.seed.reduce<Record<number, number>>((a, s) => {
    a[s] = (a[s] ?? 0) + 1;
    return a;
  }, {});
  const forV = counts[1] ?? 0;
  const against = counts[0] ?? 0;
  const abstain = counts[2] ?? 0;

  return (
    <div className="flex w-full max-w-[760px] flex-col items-center">
      <div className="mc-statusline">
        <StatusDot tone="ok" /> {t.feed.voting}
        <span className="text-ink-mute">
          · {activeIdx + 1}/{count}
        </span>
        <span className="font-mono font-medium normal-case tracking-normal text-ink-mute">· #{proposal.id.toString().slice(-6)}</span>
      </div>

      <h1 className="mc-title">{proposal.title[lang]}</h1>
      <p className="mc-body">{proposal.body[lang]}</p>

      <div className="mc-tallybar mt-3.5">
        <span style={{ flexGrow: forV, background: 'var(--color-ok)' }} />
        <span style={{ flexGrow: against, background: 'var(--color-bad)' }} />
        <span style={{ flexGrow: abstain, background: 'var(--color-ink-mute)' }} />
      </div>
      <div className="mt-2 flex gap-4 text-[12.5px] font-semibold">
        <span className="text-ok">{forV} {t.tally.for}</span>
        <span className="text-bad">{against} {t.tally.against}</span>
        <span className="text-ink-mute">{abstain} {t.tally.abstain}</span>
      </div>

      <div className="mc-dots mt-2.5">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={`mc-dot ${i === activeIdx ? 'on' : 'off'}`}
            aria-label={`proposal ${i + 1}`}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>
    </div>
  );
}

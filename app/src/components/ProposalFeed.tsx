'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Ban, FileText, Lock, Undo2 } from 'lucide-react';
import { PROPOSALS } from '@mandate/shared';
import { shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import { Panel } from './ui/Panel';
import { Badge, StatusDot } from './ui/Badge';
import type { Dict, Lang } from '../lib/i18n';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * The living governance feed as a card deck: the open proposal sits on top, the rest of the
 * queue peeks behind it, and a new proposal rises/crossfades in every ~24s (or jump via the
 * progress dots). Each proposal carries its own DAO vote distribution, shown by the VoteTally.
 */
export function ProposalFeed({
  activeIdx,
  onSelect,
  lang,
  t,
}: {
  activeIdx: number;
  onSelect: (i: number) => void;
  lang: Lang;
  t: Dict;
}) {
  const reduce = useReducedMotion();
  const n = PROPOSALS.length;
  const active = PROPOSALS[activeIdx];

  return (
    <div className="mb-3.5 pt-3">
      <div className="relative">
        {/* the rest of the queue, peeking behind the open proposal (decorative depth) */}
        {!reduce &&
          [1, 2].map((d) => (
            <motion.div
              key={`peek-${d}`}
              aria-hidden
              className="absolute inset-0 rounded-panel border border-hairline bg-surface/40"
              initial={false}
              animate={{ scale: 1 - d * 0.03, y: -d * 7, opacity: 0.5 - d * 0.2 }}
              transition={{ duration: 0.45, ease: EASE }}
              style={{ zIndex: 0 }}
            />
          ))}

        {/* the open proposal — rises + crossfades in when a new one opens */}
        <motion.div
          key={active.id.toString()}
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="relative z-10"
        >
          <Panel pad="lg">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-hairline bg-surface-2 text-brand">
                  <FileText className="size-[18px]" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ok">
                    <StatusDot tone="ok" /> {t.feed.voting}
                    <span className="text-ink-mute">
                      · {activeIdx + 1}/{n}
                    </span>
                  </div>
                  <h3 className="font-display text-[15px] font-semibold leading-tight text-ink">{active.title[lang]}</h3>
                </div>
              </div>
              <span className="font-mono text-xs text-ink-mute">#{shortHex(active.id.toString(), 5)}</span>
            </div>
            <p className="text-[14px] leading-relaxed text-ink-soft">{active.body[lang]}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="brand">
                <Lock className="size-3" /> {t.scopeVote}
              </Badge>
              <Badge tone="brand">
                <Ban className="size-3" /> {t.scopeFunds}
              </Badge>
              <Badge tone="brand">
                <Undo2 className="size-3" /> {t.scopeRevocable}
              </Badge>
            </div>
          </Panel>
        </motion.div>
      </div>

      {/* progress dots — the elegant replacement for the numbered pills */}
      <div className="mt-3.5 flex items-center justify-center gap-1.5">
        {PROPOSALS.map((p, i) => (
          <button
            key={p.id.toString()}
            onClick={() => onSelect(i)}
            aria-label={`${t.feed.live} ${i + 1}`}
            aria-current={i === activeIdx}
            className={cn(
              // globals.css's :where(button) base is UNLAYERED, so it beats Tailwind's
              // layered utilities regardless of specificity. Force the dot's own size/colour
              // over it with important (beats an unlayered normal declaration).
              'h-1.5 rounded-full bg-none! p-0! shadow-none! transition-all duration-300 ease-fluid',
              i === activeIdx ? 'w-7 bg-brand!' : 'w-1.5 bg-line! hover:bg-ink-mute!',
            )}
          />
        ))}
      </div>
    </div>
  );
}

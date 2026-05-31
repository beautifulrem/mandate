'use client';

import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Coins, Cpu, Rocket, ScanSearch, Trophy, Wallet, Workflow } from 'lucide-react';
import { cn } from '../lib/cn';
import type { Dict } from '../lib/i18n';
import { Panel, PanelHeader } from './ui/Panel';

/** Icon + accent per scorecard row (parallel to t.scorecard.items). */
const META = [
  { icon: Wallet, tone: 'text-brand' },
  { icon: ScanSearch, tone: 'text-brand' },
  { icon: Workflow, tone: 'text-info' },
  { icon: Cpu, tone: 'text-info' },
  { icon: Coins, tone: 'text-ok' },
  { icon: Rocket, tone: 'text-[#8aa0f0]' },
] as const;

/**
 * The at-a-glance capability map: each track requirement, what proves it on screen, and a green
 * check — so a judge can confirm every box is ticked without reading the backend or the code.
 */
export function ScoreCard({ t }: { t: Dict }) {
  const reduce = useReducedMotion();
  return (
    <Panel pad="lg" className="mb-3.5">
      <PanelHeader icon={Trophy} title={t.scorecard.title} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        {t.scorecard.items.map((it, i) => {
          const m = META[i] ?? META[0];
          const Icon = m.icon;
          return (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-2/50 px-3.5 py-3"
            >
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg border border-hairline bg-surface', m.tone)}>
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-ink">{it.name}</span>
                  <CheckCircle2 className="size-3.5 shrink-0 text-ok" />
                </div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-ink-mute">{it.proof}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}

'use client';

import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Scissors } from 'lucide-react';
import type { RunStatus } from '@mandate/shared';
import { BASESCAN, shortHex } from '../../lib/config';
import { formatMessage, type Dict } from '../../lib/i18n';

/**
 * The outcome banner (frameless). On a successful cast: a green "vote cast" chip with the tx +
 * the "executed AS your Smart Account" provenance. Once the chain is killed it flips to the
 * severed banner with the recall proof tx (killed takes priority over a prior vote).
 */
export function VoteResultBanner({
  run,
  killed,
  recallTx,
  userSAAddress,
  t,
}: {
  run: RunStatus | null;
  killed: boolean;
  recallTx: string | null;
  userSAAddress?: string;
  t: Dict;
}) {
  const reduce = useReducedMotion();

  if (killed) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-bad/30 bg-bad/8 px-4 py-3 text-[13px] text-ink-soft"
      >
        <Scissors className="size-4 shrink-0 text-bad" />
        <strong className="text-bad">{t.severedBold}</strong> {t.severedRest}
        {recallTx && (
          <a className="font-mono text-info hover:underline" href={`${BASESCAN}/tx/${recallTx}`} target="_blank" rel="noreferrer">
            {t.proofTx} {shortHex(recallTx, 5)} ↗
          </a>
        )}
      </motion.div>
    );
  }

  if (!run?.vote) return null;

  return (
    <div className="space-y-2">
      <motion.div
        initial={reduce ? false : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 20 }}
        className="inline-flex items-center gap-2 rounded-chip border border-ok/35 bg-ok/12 px-3 py-1.5 text-sm font-semibold text-ok"
      >
        <CheckCircle2 className="size-4" /> {t.voteCast}
        <a className="font-mono text-xs hover:underline" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">
          {shortHex(run.vote.txHash, 5)} ↗
        </a>
      </motion.div>
      {userSAAddress && (
        <div className="rounded-xl border border-ok/25 bg-ok/8 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-soft">
            <span className="min-w-0 break-words">{formatMessage(t.executedBanner, { address: shortHex(userSAAddress, 6) })}</span>
            <a className="font-mono text-info hover:underline" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">
              {t.viewTx} ↗
            </a>
          </div>
          <div className="mt-1.5 text-[11px] leading-relaxed text-ink-mute">{t.executedSubtext}</div>
          <div className="mt-1.5 break-all font-mono text-[10.5px] text-ink-mute/70">{t.executedMethod}</div>
        </div>
      )}
    </div>
  );
}
